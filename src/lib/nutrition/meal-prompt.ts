/** The meal-breakdown prompt, shared by the food estimate route and the accuracy check (pure). */
import { MEASURE_HINTS, STAPLES } from "@/modules/nutrition/staples";
import { DISHES } from "@/modules/nutrition/dishes";
import { measureRulesForAi } from "@/modules/nutrition/measures";
import { mentions, relevantFoods } from "@/modules/nutrition/relevant";

/**
 * `text` (a typed meal, no photo): list only the staples and dishes its words
 * point to, with every other staple as a bare key: about a third of the
 * tokens. A photo gets the full lists, since there are no words to go on.
 */
export function mealCalcSystemPrompt(household: { foods: string[]; recipes: string[] }, opts: { text?: string } = {}) {
  const rel = opts.text ? relevantFoods(opts.text) : null;
  const foods = opts.text ? household.foods.filter((f) => mentions(opts.text!, f)) : household.foods;
  const recipes = opts.text ? household.recipes.filter((r) => mentions(opts.text!, r)) : household.recipes;
  const staples = rel
    ? `Built-in staples that fit this meal (key: name): ${STAPLES.filter((s) => rel.staples.has(s.key)).map((s) => `${s.key}: ${s.name}`).join("; ")}\nOther built-in staple keys: ${STAPLES.filter((s) => !rel.staples.has(s.key)).map((s) => s.key).join(", ")}`
    : `Built-in staples (key: name): ${STAPLES.map((s) => `${s.key}: ${s.name}`).join("; ")}`;
  const dishes = rel
    ? rel.dishes.length
      ? `Built-in Indian dishes that may match (key: name — standard serving): ${rel.dishes.map((d) => `${d.key}: ${d.name} — ${d.serving}`).join("; ")}`
      : "No built-in dish matches these words: break dishes down into ingredients."
    : `Built-in Indian dishes (key: name — standard serving): ${DISHES.map((d) => `${d.key}: ${d.name} — ${d.serving}`).join("; ")}`;
  // Fixed parts first, the household's own lists last: Gemini bills a prompt start it has seen recently at about a tenth.
  const context = [
    staples,
    dishes,
    MEASURE_HINTS,
    measureRulesForAi(rel?.staples),
    foods.length ? `Household's own foods: ${foods.join("; ")}` : "",
    recipes.length ? `Household's saved recipes (calculated nutrition): ${recipes.join("; ")}` : "",
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
