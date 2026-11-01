import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { mealCalcSchema } from "@/lib/ai/phase2-schemas";
import { householdFoods, matchIngredient } from "@/lib/nutrition/resolve";
import { MEASURE_HINTS, STAPLES } from "@/modules/nutrition/staples";
import { computeItem, type CalcItem } from "@/modules/nutrition/compute";
import { cleanIrritants } from "@/modules/nutrition/irritants";
import type { Nutrients } from "@/modules/nutrition/nutrients";

/**
 * Turns a description/photo of a meal into nutrition. AI only breaks it down
 * (saved recipe + servings, or ingredients + grams); the numbers come from
 * food data. If something can't be matched, the AI's own estimate is used
 * and the item is marked "estimated".
 */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("food_diary")) throw new AiError("Food diary is turned off.", 403);
    const form = await request.formData();
    const text = z.string().trim().max(1000).parse(form.get("text") ?? "");
    const hint = z.string().max(40).parse(form.get("time") ?? "");
    const photo = await imagePart(form.get("photo"));
    if (!text && !photo) throw new AiError("Describe the food or add a photo.");

    const hh = await householdFoods(session);
    const context = [
      `Built-in staples (key: name): ${STAPLES.map((s) => `${s.key}: ${s.name}`).join("; ")}`,
      hh.foods.length ? `Household's own foods: ${hh.foods.map((f) => f.name).join("; ")}` : "",
      hh.recipes.length ? `Household's saved recipes (calculated nutrition): ${hh.recipes.map((r) => r.title).join("; ")}` : "",
      MEASURE_HINTS,
    ]
      .filter(Boolean)
      .join("\n\n");

    const system = `You break meals into parts so nutrition can be CALCULATED from food data. This is mostly Indian home cooking.
For each item: if it matches one of the household's saved recipes, set recipe_title and recipe_servings and leave components empty.
Otherwise list its ingredients with grams for the amount eaten (raw/dry weight for grains, flours and pulses; include cooking oil/ghee, typically 5–10 g per katori of sabzi or dal tadka). Prefer staple_key, then custom_food, else a plain English 'search' term.
Also give your own overall estimate for the item. Mark bladder irritants honestly (e.g. chilli-hot curry = spicy, tomato gravy = tomato, chai/coffee = caffeine).

${context}`;

    const result = await runJson(session, {
      feature: "food_estimate",
      schema: mealCalcSchema,
      parts: [...(photo ? [photo] : []), { text: `Local time: ${hint || "unknown"}.\n${text ? `What I ate: ${text}` : "Work out the food in this photo."}` }],
      system,
      temperature: 0.1,
    });

    const items = await Promise.all(
      result.items.map(async (it) => {
        const recipe = it.recipe_title ? hh.recipes.find((r) => r.title.toLowerCase() === it.recipe_title!.toLowerCase()) : undefined;
        const components = recipe
          ? []
          : await Promise.all(
              it.components.map(async (c) => {
                const m = await matchIngredient(session, { staple_key: c.staple_key, custom_food: c.custom_food, search: c.search, name: c.name }, hh);
                return { name: c.name, grams: c.grams, per100: m?.per100 ?? null, matchName: m?.name ?? null, source: m?.source ?? null, ref: m?.ref ?? null, irritants: m?.irritants ?? [] };
              }),
            );
        const calc: CalcItem = {
          description: it.description,
          quantity: it.quantity,
          recipe:
            recipe && recipe.nutrition
              ? {
                  id: recipe.id,
                  title: recipe.title,
                  servings: it.recipe_servings ?? 1,
                  perServing: recipe.nutrition as Nutrients,
                  servingG: recipe.total_weight_g ? Number(recipe.total_weight_g) / recipe.servings : null,
                }
              : null,
          components,
          estimate: it.estimate,
          irritants: [...new Set([...cleanIrritants(it.irritants), ...cleanIrritants(recipe?.irritants), ...components.flatMap((c) => c.irritants)])],
        };
        return { ...calc, ...computeItem(calc) };
      }),
    );
    return { meal: result.meal, note: result.note, items };
  });
}
