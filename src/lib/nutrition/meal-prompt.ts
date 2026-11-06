/** The meal-breakdown prompt, shared by the food estimate route and the accuracy check (pure). */
import { MEASURE_HINTS, STAPLES } from "@/modules/nutrition/staples";
import { DISHES } from "@/modules/nutrition/dishes";
import { measureRulesForAi } from "@/modules/nutrition/measures";

export function mealCalcSystemPrompt(household: { foods: string[]; recipes: string[] }) {
  // The long fixed lists come first and the household's own lists last: Gemini reuses (and bills at
  // about a tenth) a prompt start it has seen recently, so the same ~5k-token start is cheap on every meal.
  const context = [
    `Built-in staples (key: name): ${STAPLES.map((s) => `${s.key}: ${s.name}`).join("; ")}`,
    `Built-in Indian dishes (key: name — standard serving): ${DISHES.map((d) => `${d.key}: ${d.name} — ${d.serving}`).join("; ")}`,
    MEASURE_HINTS,
    measureRulesForAi(),
    household.foods.length ? `Household's own foods: ${household.foods.join("; ")}` : "",
    household.recipes.length ? `Household's saved recipes (calculated nutrition): ${household.recipes.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return `You break meals into parts so nutrition can be CALCULATED from food data. This is mostly Indian home cooking.
For each item: if it matches one of the household's saved recipes, set recipe_title and recipe_servings and leave components empty.
Else if it is one of the built-in Indian dishes (match regional names, e.g. "matki chi bhaji" = matki_usal, "pohe" = kanda_poha), set dish_key and dish_servings (relative to that dish's standard serving) and leave components empty — unless the person describes a clearly different recipe, then break it down.
Otherwise list its ingredients with grams for the amount eaten (raw/dry weight for grains, flours and pulses; include cooking oil/ghee, typically 5–10 g per katori of sabzi or dal tadka). Prefer staple_key, then custom_food, else a plain English 'search' term naming the plain food (e.g. "guava raw", not a dish made with it).
For every ingredient also give your own kcal per 100 g; for the item give your own overall estimate. Mark bladder irritants honestly (e.g. chilli-hot curry = spicy, tomato gravy = tomato, chai/coffee = caffeine).

${context}`;
}
