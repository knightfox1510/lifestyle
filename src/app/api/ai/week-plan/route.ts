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
  /** Allow a different dish for one person when their goals, diet or health call for it. */
  separate: z.boolean().optional(),
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

    // People get short keys (p1, p2…) so the answer can say who eats what and how much.
    const people = session.members.map((m, i) => ({ key: `p${i + 1}`, id: m.user_id, name: m.display_name, facts: facts[i] }));
    const peopleText = people
      .map((p) => {
        const n = p.facts.nutrition;
        const targets = n?.calories ? `daily target ${n.calories} kcal, ${n.protein_g ?? "?"} g protein, ${n.carbs_g ?? "?"} g carbs, ${n.fat_g ?? "?"} g fat` : p.facts.maintenance ? `no target set; maintenance about ${p.facts.maintenance} kcal` : "no calorie target known";
        return `${p.key} = ${p.name}: ${targets}.\n${p.facts.text || "(no other details shared)"}`;
      })
      .join("\n\n");
    const prompt = `Plan meals for a household of ${session.members.length} for the days below. They do their grocery shopping on ${shortDay(input.weekStart)} ${shortDate(input.weekStart)}, so one shop should cover the whole week.
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

The people (use these keys):
${peopleText}
${input.notes ? `\nWishes for this week: ${input.notes}` : ""}

Portions: most dishes are shared (for = "all"); give each person their own servings so that, across breakfast, lunch, snacks and dinner, their day lands near their own calorie and protein targets (e.g. 1.5 servings for the person with the higher target, 0.75 for the lower). Give kcal and macros for ONE standard serving.
${input.separate ? "When one person's goal, diet or health clearly needs it (e.g. extra protein, bladder irritants to avoid, a different diet), you may plan a separate dish for that person in the same slot (for = their key), plus a shared one for the others; keep this to a few slots so cooking stays practical." : "Everyone eats the same dish in each slot (for = \"all\"); adjust only the portions."}
Ingredients: per dish, what to buy for all its portions in Indian household quantities (e.g. "250 g", "1 bunch", "6"); skip salt, water and everyday masalas.`;

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
    const byKey = new Map(people.map((p) => [p.key, p.id]));
    const meals = result.meals
      .filter((x) => allowed.has(`${x.date}|${x.meal}`))
      .map((x) => {
        const r = x.recipe_title ? byTitle.get(x.recipe_title.toLowerCase()) : undefined;
        const forUser = x.for !== "all" ? (byKey.get(x.for) ?? null) : null;
        const portions = Object.fromEntries(
          x.portions.map((p) => [byKey.get(p.person), Math.round(p.servings * 4) / 4] as const).filter(([id]) => id && (!forUser || id === forUser)),
        ) as Record<string, number>;
        const eaters = forUser ? [forUser] : people.map((p) => p.id);
        const total = eaters.reduce((a, id) => a + (portions[id] ?? 1), 0);
        return {
          date: x.date,
          meal: x.meal,
          title: r ? r.title : x.title,
          recipe_id: r?.id ?? null,
          for_user: forUser,
          portions,
          servings: Math.min(20, Math.max(1, Math.ceil(total))),
          usual: x.usual,
          kcal_per_serving: x.kcal_per_serving,
          protein_g: x.protein_g,
          carbs_g: x.carbs_g,
          fat_g: x.fat_g,
          ingredients: x.ingredients.filter((i) => !(pantry.length && inPantry(i.name, pantry))),
        };
      });
    return { meals, note: result.note, people: people.map((p) => ({ id: p.id, name: p.name, kcal: p.facts.nutrition?.calories ?? null, protein: p.facts.nutrition?.protein_g ?? null })) };
  });
}
