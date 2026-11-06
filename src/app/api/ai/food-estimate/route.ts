import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { mealCalcSchema } from "@/lib/ai/phase2-schemas";
import { householdFoods, matchIngredient } from "@/lib/nutrition/resolve";
import { DISH_BY_KEY, dishNutrition } from "@/modules/nutrition/dishes";
import { mealCalcSystemPrompt } from "@/lib/nutrition/meal-prompt";
import { computeItem, type CalcItem } from "@/modules/nutrition/compute";
import { cleanIrritants } from "@/modules/nutrition/irritants";
import type { Nutrients } from "@/modules/nutrition/nutrients";
import { mealForHour } from "@/modules/food/meta";

/** Long AI jobs (documents, photos, whole-week plans) can take a while: up to 5 minutes on Vercel. */
export const maxDuration = 300;

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
    const system = mealCalcSystemPrompt({ foods: hh.foods.map((f) => f.name), recipes: hh.recipes.map((r) => r.title) });

    const result = await runJson(session, {
      feature: "food_estimate", maxDuration,
      schema: mealCalcSchema,
      parts: [...(photo ? [photo] : []), { text: `Local time: ${hint || "unknown"}.\n${text ? `What I ate: ${text}` : "Work out the food in this photo."}` }],
      system,
      temperature: 0.1,
      // The same meal typed again (no photo) at the same kind of mealtime reuses the answer for 60 days.
      cache: photo ? undefined : { key: `${text.toLowerCase().replace(/\s+/g, " ")}\n${hint ? mealForHour(Number(hint.slice(0, 2)) || 12) : ""}`, days: 60 },
    });

    const items = await Promise.all(
      result.items.map(async (it) => {
        const recipe = it.recipe_title ? hh.recipes.find((r) => r.title.toLowerCase() === it.recipe_title!.toLowerCase()) : undefined;
        const dish = !recipe && it.dish_key ? DISH_BY_KEY[it.dish_key] : undefined;
        const components = recipe || dish
          ? []
          : await Promise.all(
              it.components.map(async (c) => {
                const m = await matchIngredient(session, { staple_key: c.staple_key, custom_food: c.custom_food, search: c.search, name: c.name, kcal_per_100g: c.kcal_per_100g }, hh);
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
                  kind: "recipe",
                }
              : dish
                ? { id: dish.key, title: dish.name, servings: it.dish_servings ?? 1, perServing: dishNutrition(dish), servingG: dish.servingG, kind: "dish" }
                : null,
          components,
          estimate: it.estimate,
          irritants: [...new Set([...cleanIrritants(it.irritants), ...cleanIrritants(recipe?.irritants), ...(dish?.irritants ?? []), ...components.flatMap((c) => c.irritants)])],
        };
        return { ...calc, ...computeItem(calc) };
      }),
    );
    return { meal: result.meal, note: result.note, items };
  });
}
