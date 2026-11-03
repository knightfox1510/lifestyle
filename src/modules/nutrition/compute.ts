import { forGrams, scale, sum, type Nutrients } from "./nutrients";

export type Accuracy = "calculated" | "label" | "estimated";

export type CalcComponent = { name: string; grams: number; per100: Nutrients | null; matchName?: string | null; source?: string | null; ref?: unknown; irritants?: string[]; /** Picked by the person (not the automatic match). */ fixed?: boolean };
export type CalcItem = {
  description: string;
  quantity: string | null;
  /** A saved recipe, or (kind "dish") a built-in Indian dish — both counted in servings. */
  recipe?: { id: string; title: string; servings: number; perServing: Nutrients; servingG?: number | null; kind?: "recipe" | "dish" } | null;
  components: CalcComponent[];
  estimate: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  irritants: string[];
  /** The person chose the AI's own estimate over the calculated numbers. */
  useEstimate?: boolean;
};

/**
 * Nutrition for one logged item. Saved recipe → its calculated per-serving
 * values × servings. Ingredients → sum of grams × food data, but only if
 * every ingredient was matched (otherwise we fall back to the AI estimate and
 * don't pretend to know micronutrients).
 */
export function computeItem(item: CalcItem): { nutrients: Nutrients; accuracy: Accuracy; grams: number | null } {
  if (item.useEstimate) {
    const grams = item.components.reduce((a, c) => a + (c.grams > 0 ? c.grams : 0), 0) || (item.recipe?.servingG ? Math.round(item.recipe.servingG * item.recipe.servings) : null);
    return { nutrients: { ...item.estimate }, accuracy: "estimated", grams };
  }
  if (item.recipe) {
    return {
      nutrients: scale(item.recipe.perServing, item.recipe.servings),
      accuracy: "calculated",
      grams: item.recipe.servingG ? Math.round(item.recipe.servingG * item.recipe.servings) : null,
    };
  }
  const comps = item.components.filter((c) => c.grams > 0);
  const grams = comps.reduce((a, c) => a + c.grams, 0) || null;
  if (comps.length && comps.every((c) => c.per100 && typeof c.per100.calories === "number")) {
    return { nutrients: sum(comps.map((c) => forGrams(c.per100!, c.grams))), accuracy: "calculated", grams };
  }
  return { nutrients: { ...item.estimate }, accuracy: "estimated", grams };
}

/** Scale an item's nutrients for one person's portion (1 = as described). */
export function portionFor(nutrients: Nutrients, factor: number) {
  return factor === 1 ? nutrients : scale(nutrients, factor);
}

/**
 * When the calculated calories and the AI's own estimate for an item are far
 * apart (beyond ~1.6× and 40 kcal), one of them is probably wrong: a bad
 * database match, wrong grams, or a misread dish. Returns both numbers so the
 * person can choose; null when they agree or there's nothing to compare.
 */
export function disagreement(item: CalcItem): { calculated: number; ai: number } | null {
  if (item.useEstimate) return null;
  const c = computeItem(item);
  if (c.accuracy !== "calculated") return null;
  const calculated = Math.round(c.nutrients.calories ?? 0);
  const ai = Math.round(item.estimate.calories);
  if (!ai && !calculated) return null;
  const ratio = (calculated + 20) / (ai + 20);
  return Math.abs(calculated - ai) > 40 && (ratio > 1.6 || ratio < 1 / 1.6) ? { calculated, ai } : null;
}
