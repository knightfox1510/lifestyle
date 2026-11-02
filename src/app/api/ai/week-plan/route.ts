import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { MEALS, weekPlanSchema } from "@/lib/ai/phase2-schemas";
import { SAFETY_INSTRUCTIONS, buildAiContext } from "@/lib/ai/context";
import { personFacts } from "@/lib/ai/person-facts";
import { addDays, shortDate, shortDay, todayIn } from "@/lib/dates";
import { daysUntil, inPantry } from "@/modules/pantry/match";
import { MEAL_META } from "@/modules/food/meta";
import { loadUsuals } from "@/lib/week-plan";
import type { MealPlanEntry, PantryItem } from "@/lib/types";

/** Long AI jobs (documents, photos, whole-week plans) can take a while: up to 5 minutes on Vercel. */
export const maxDuration = 300;

const body = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meals: z.array(z.enum(MEALS)).min(1).max(5),
  variety: z.enum(["usual", "mix", "new"]),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const input = body.parse(await request.json());
    const today = todayIn(session.profile.timezone);
    const days = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i)).filter((d) => d >= today);
    if (!days.length) throw new AiError("That week is already over. Pick this week or a later one.");

    const [{ usuals }, planRes, recipesRes, pantryRes, ctx, ...facts] = await Promise.all([
      loadUsuals(session, today),
      session.supabase.from("meal_plan").select("*").eq("household_id", session.household.id).gte("plan_date", days[0]).lte("plan_date", days.at(-1)!),
      session.supabase.from("recipes").select("id, title, servings").eq("household_id", session.household.id).order("title").limit(200),
      session.isModuleEnabled("pantry")
        ? session.supabase.from("pantry_items").select("*").eq("household_id", session.household.id).is("used_up_at", null).limit(300)
        : Promise.resolve({ data: [] }),
      buildAiContext(session, { subjectId: session.userId, useMedicalHistory: false }),
      ...session.members.map((m) => personFacts(session, m.user_id)),
    ]);
    const planned = (planRes.data ?? []) as MealPlanEntry[];
    const recipes = (recipesRes.data ?? []) as { id: string; title: string; servings: number }[];
    const pantry = (pantryRes.data ?? []) as PantryItem[];
    const recipeTitle = new Map(recipes.map((r) => [r.id, r.title]));

    // Only fill slots that are still empty.
    const slots = days.flatMap((d) => input.meals.filter((m) => !planned.some((p) => p.plan_date === d && p.meal === m)).map((m) => ({ d, m })));
    if (!slots.length) throw new AiError("Every chosen meal this week is already planned.");

    const usualText = input.meals
      .map((m) => `${MEAL_META[m].label}: ${usuals[m].length ? usuals[m].map((u) => `${u.title} (${u.count}×)`).join(", ") : "(nothing logged yet)"}`)
      .join("\n");
    const plannedText = planned.length
      ? planned.map((p) => `- ${p.plan_date} ${p.meal}: ${(p.recipe_id && recipeTitle.get(p.recipe_id)) || p.title}`).join("\n")
      : "(nothing yet)";
    const pantryText = pantry.length
      ? pantry
          .map((p) => {
            const d = daysUntil(p.expires_on, today);
            return `- ${p.name}${p.quantity ? ` (${p.quantity})` : ""}${d !== null && d >= 0 && d <= 4 ? ` [use soon: ${d} day${d === 1 ? "" : "s"}]` : ""}`;
          })
          .join("\n")
      : "(pantry not tracked)";
    const variety =
      input.variety === "usual"
        ? "Stick to their usual meals; repeat favourites, but don't serve the same lunch or dinner two days running."
        : input.variety === "new"
          ? "Bring in new dishes they'd likely enjoy, in the same cuisine and effort level as their usuals; keep about a third usual meals."
          : "Mostly their usual meals (about two thirds), plus a few new dishes in the same style for variety.";

    const prompt = `Plan meals for a household of ${session.members.length} for the days below. They do their grocery shopping on ${shortDay(input.weekStart)} ${shortDate(input.weekStart)}, so the shopping list should cover the whole week.
Fill ONLY these empty slots (date, meal):
${slots.map((s) => `- ${s.d} (${shortDay(s.d)}) ${s.m}`).join("\n")}

${variety}
Keep weekday breakfasts and lunches quick; save longer dishes for weekends. Balance protein and vegetables across the week, and reuse ingredients so little is wasted (e.g. one bunch of methi for two dishes). Use pantry items marked "use soon" early in the week.

Their usual meals (learned from what they logged recently, most frequent first):
${usualText}

Already planned (keep, don't repeat on adjacent days):
${plannedText}

Saved recipes: ${recipes.length ? recipes.map((r) => r.title).join("; ") : "(none)"}

Pantry:
${pantryText}

${facts.map((f, i) => `About ${session.members[i].display_name}:\n${f.text}`).join("\n\n")}
${input.notes ? `\nWishes for this week: ${input.notes}` : ""}

Shopping list: combine across the week with total quantities in Indian household terms (e.g. "1 kg", "2 bunches", "500 g"), leave out what's in the pantry and basic masalas they'd already have.`;

    const result = await runJson(session, {
      feature: "week_plan", maxDuration,
      schema: weekPlanSchema,
      parts: [{ text: prompt }],
      system: `${SAFETY_INSTRUCTIONS}\nYou are also a practical home cook and meal planner who knows Indian (especially Maharashtrian) home cooking.\n\n${ctx.text}`,
      usedHealth: ctx.usedMedical,
      temperature: 0.7,
    });

    const allowed = new Set(slots.map((s) => `${s.d}|${s.m}`));
    const byTitle = new Map(recipes.map((r) => [r.title.toLowerCase(), r]));
    const meals = result.meals
      .filter((x) => allowed.has(`${x.date}|${x.meal}`))
      .map((x) => {
        const r = x.recipe_title ? byTitle.get(x.recipe_title.toLowerCase()) : undefined;
        return { date: x.date, meal: x.meal, title: r ? r.title : x.title, recipe_id: r?.id ?? null, servings: r?.servings ?? session.members.length, usual: x.usual };
      });
    const shopping = result.shopping.filter((s) => !(pantry.length && inPantry(s.name, pantry)));
    return { meals, shopping, note: result.note };
  });
}
