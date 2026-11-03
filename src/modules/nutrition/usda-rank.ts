/**
 * USDA's own search ranks by text relevance, so "guava" can return "Pastry,
 * Pastelitos de Guava" first. Re-rank: the food itself before dishes and
 * products made from it, raw before processed, unless you asked for those.
 */

/** Words that mean "a product made from it" rather than the food itself. */
const PROCESSED = [
  "pastry", "pastelito", "pie", "cake", "cookie", "biscuit", "cracker", "bread", "muffin", "pudding", "dessert", "candy", "candied", "jam", "jelly",
  "preserve", "marmalade", "syrup", "sweetened", "nectar", "juice", "drink", "beverage", "smoothie", "shake", "sauce", "soup", "canned", "frozen",
  "dried", "dehydrated", "powder", "flavored", "flavoured", "chocolate", "babyfood", "baby", "infant", "formula", "toddler", "fast", "restaurant",
  "fried", "breaded", "battered", "chips", "snack", "bar", "cereal", "ice", "cream", "yogurt", "sherbet", "sorbet", "topping", "filling", "mix",
  "prepared", "imitation", "light", "reduced",
];

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("es") && !/(ses|ches|shes)$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

/** Higher is better. Exported for tests. */
export function usdaScore(query: string, description: string) {
  const q = words(query).filter((w) => !["pink", "white", "red", "green", "fresh", "ripe", "organic", "desi", "homemade"].includes(w));
  const d = words(description);
  const head = d[0] ?? "";
  let score = 0;
  for (const w of q) if (d.includes(w)) score += 3;
  // USDA names lead with the food: "Guavas, common, raw".
  if (q.includes(head)) score += 4;
  for (const w of d) if (PROCESSED.includes(w) && !q.includes(w)) score -= 5;
  const asked = (w: string) => query.toLowerCase().includes(w);
  if (d.includes("raw") && !asked("cooked") && !asked("boiled") && !asked("fried")) score += 2;
  // Shorter descriptions are usually the plain food.
  score -= Math.max(0, d.length - 4) * 0.3;
  return score;
}

export function rankUsda<T extends { name: string }>(query: string, foods: T[]): T[] {
  return foods
    .map((f, i) => ({ f, i, s: usdaScore(query, f.name) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f);
}

/**
 * Is a matched food's energy believable next to the AI's own estimate for
 * that ingredient? Off by more than about 2× (with some slack for very light
 * foods like cucumber) means the match is probably the wrong food.
 */
export function plausibleKcal(actualPer100: number | undefined, expectedPer100: number | null | undefined, tolerance = 2) {
  if (expectedPer100 == null || actualPer100 == null) return true;
  const ratio = (actualPer100 + 25) / (expectedPer100 + 25);
  return ratio >= 1 / tolerance && ratio <= tolerance;
}
