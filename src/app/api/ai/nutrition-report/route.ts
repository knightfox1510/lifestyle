import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { SAFETY_INSTRUCTIONS, buildAiContext } from "@/lib/ai/context";
import { weekNutrition } from "@/lib/nutrition/week";
import { NUTRIENT_META, formatNutrient, type NutrientKey } from "@/modules/nutrition/nutrients";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

const schema = z.object({ summary: z.string().max(600), tips: z.array(z.string().max(300)).min(1).max(4) });

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const { week } = z.object({ week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(await request.json());
    const ownerId = session.subject.user_id;
    if (session.accessTo("food_diary", ownerId) === "none") throw new AiError("Not shared with you.", 403);
    const r = await weekNutrition(session, ownerId, week);
    if (!r.logged) throw new AiError("No food logged that week.");
    const ctx = await buildAiContext(session, { subjectId: ownerId });
    const line = (k: NutrientKey) => `${NUTRIENT_META[k].label}: ${formatNutrient(k, r.avg[k])}${r.targets[k] ? ` (${r.targets[k]!.kind === "max" ? "limit" : "target"} ${formatNutrient(k, r.targets[k]!.amount)})` : ""}`;
    const prompt = `Weekly nutrition review for the week of ${r.monday} (${r.logged} days logged, ${r.coverage.withData}/${r.coverage.total} items with full nutrient data).
Daily averages: ${(["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sat_fat_g", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg", "vit_d_mcg", "b12_mcg", "folate_mcg"] as NutrientKey[]).map(line).join("; ")}.
Goal calories: ${r.goals?.calories ?? "not set"}; protein goal: ${r.goals?.protein_g ?? "not set"} g.
Top calorie sources: ${r.top.calories.map((x) => `${x.name} (${Math.round(x.n.calories ?? 0)} kcal over ${x.times}×)`).join(", ")}.
Top sodium sources: ${r.top.sodium_mg.map((x) => x.name).join(", ") || "n/a"}.
Gaps: ${r.gaps.map((g) => NUTRIENT_META[g.k].label).join(", ") || "none"}. Days with 2+ bladder irritants: ${r.irritantDays}. Restaurant items: ${r.restaurantItems}.
Low/high blood tests linked to nutrients: ${[...r.labLinks.entries()].map(([k, l]) => `${NUTRIENT_META[k].label} (${l.marker} ${l.value}, ${l.flag})`).join(", ") || "none"}.

Write a 2–3 sentence summary and 2–4 specific, practical tips using Indian home-food swaps (e.g. add a katori of rajma, swap a namkeen for roasted chana). Respect diet type, allergies and conditions. If coverage is low, say micronutrient numbers are incomplete.`;
    return runJson(session, { feature: "nutrition_report", schema, parts: [{ text: prompt }], system: `${SAFETY_INSTRUCTIONS}\n\n${ctx.text}`, usedHealth: ctx.usedMedical, temperature: 0.5 });
  });
}
