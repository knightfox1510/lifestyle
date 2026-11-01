import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { MEALS, mealIdeasSchema } from "@/lib/ai/phase2-schemas";
import { SAFETY_INSTRUCTIONS, buildAiContext } from "@/lib/ai/context";
import { personFacts } from "@/lib/ai/person-facts";
import { addDays, localDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { totals } from "@/modules/food/meta";
import { daysUntil, inPantry } from "@/modules/pantry/match";
import type { FoodEntry, PantryItem } from "@/lib/types";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

const body = z.object({
  subjectId: z.uuid(),
  meal: z.enum(MEALS),
  mode: z.enum(["pantry", "expiring", "any"]),
  maxMinutes: z.number().int().min(5).max(240),
  servings: z.number().int().min(1).max(12),
  notes: z.string().trim().max(500).optional(),
  useMedicalHistory: z.boolean().optional(),
});

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const input = body.parse(await request.json());
    if (!session.members.some((m) => m.user_id === input.subjectId)) throw new AiError("Unknown person", 403);
    const tz = session.profile.timezone;
    const today = todayIn(tz);

    const [ctx, facts, pantryRes, foodRes] = await Promise.all([
      buildAiContext(session, { subjectId: input.subjectId, useMedicalHistory: input.useMedicalHistory }),
      personFacts(session, input.subjectId),
      session.isModuleEnabled("pantry")
        ? session.supabase.from("pantry_items").select("*").eq("household_id", session.household.id).is("used_up_at", null).limit(300)
        : Promise.resolve({ data: [] }),
      session.isModuleEnabled("food_diary") && session.accessTo("food_diary", input.subjectId) !== "none"
        ? session.supabase.from("food_entries").select("*").eq("owner_id", input.subjectId).gte("eaten_at", startOfLocalDayIso(today)).lt("eaten_at", startOfLocalDayIso(addDays(today, 3)))
        : Promise.resolve({ data: [] }),
    ]);
    const pantry = (pantryRes.data ?? []) as PantryItem[];
    const eaten = totals(((foodRes.data ?? []) as FoodEntry[]).filter((e) => localDate(e.eaten_at, tz) === today));
    const target = facts.nutrition?.calories ?? null;

    const pantryText = pantry.length
      ? pantry
          .map((p) => {
            const d = daysUntil(p.expires_on, today);
            return `- ${p.name}${p.quantity ? ` (${p.quantity})` : ""}${d !== null ? (d < 0 ? " [EXPIRED, don't use]" : d <= 3 ? ` [expires in ${d} day${d === 1 ? "" : "s"}]` : "") : ""}`;
          })
          .join("\n")
      : "(pantry not tracked)";

    const mode =
      input.mode === "pantry"
        ? "Use mainly what is in the pantry; at most 3 extra ingredients to buy."
        : input.mode === "expiring"
          ? "Prioritise ingredients that expire soon (marked); other pantry items are fine too."
          : "Any ingredients are fine, but prefer pantry items when they fit.";

    const prompt = `Suggest 3 ${input.meal} ideas for ${input.servings} serving(s), ready within ${input.maxMinutes} minutes total.
${mode}
${target ? `Today so far: ${eaten.calories} of ${target} kcal, ${eaten.protein_g} g protein. Fit this meal into what's left.` : ""}
${facts.text}
${input.notes ? `Extra wishes: ${input.notes}` : ""}

Pantry:
${pantryText}

Mark each ingredient's in_pantry honestly against the pantry list. Calories and macros are per serving. Keep steps short and practical.`;

    const result = await runJson(session, {
      feature: "meal_ideas",
      schema: mealIdeasSchema,
      parts: [{ text: prompt }],
      system: `${SAFETY_INSTRUCTIONS}\nYou are also a practical home cook who knows Indian and global home cooking.\n\n${ctx.text}`,
      usedHealth: ctx.usedMedical,
      temperature: 0.8,
    });
    // Double-check "in pantry" against our own matching so grocery suggestions are reliable.
    for (const idea of result.ideas) {
      for (const ing of idea.ingredients) ing.in_pantry = pantry.length > 0 && inPantry(ing.name, pantry);
    }
    return { ...result, usedHealth: ctx.usedMedical, remaining: target ? target - eaten.calories : null };
  });
}
