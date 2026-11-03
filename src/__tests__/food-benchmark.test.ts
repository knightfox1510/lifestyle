/**
 * Accuracy benchmark: the app's built-in numbers against independent
 * reference values (USDA FoodData Central SR Legacy and IFCT 2017 averages,
 * and typical published values for one serving of common Indian dishes).
 * A change that makes everyday foods drift beyond these ranges fails here
 * before anyone sees it. Ranges, not exact numbers: real food varies.
 */
import { describe, expect, it } from "vitest";
import { STAPLE_BY_KEY, searchStaples } from "@/modules/nutrition/staples";
import { DISH_BY_KEY, dishNutrition } from "@/modules/nutrition/dishes";
import { rankUsda } from "@/modules/nutrition/usda-rank";

// kcal per 100 g (raw/as sold unless stated): reference value. Allowed: ±15%.
const PER_100G: [key: string, kcal: number][] = [
  ["rice_white", 365], ["atta", 340], ["oats", 379], ["poha", 346], ["besan", 387], ["rava", 360], ["jowar", 349], ["ragi", 320],
  ["toor", 343], ["moong", 347], ["masoor", 358], ["chana", 378], ["rajma", 333], ["urad", 341],
  ["milk_whole", 61], ["milk_toned", 58], ["curd", 61], ["paneer", 265], ["ghee", 900], ["butter", 717], ["oil_sunflower", 884],
  ["egg", 143], ["chicken_breast", 120], ["fish_lean", 105],
  ["potato", 77], ["onion", 40], ["tomato", 18], ["spinach", 23], ["okra", 33], ["cauliflower", 25], ["carrot", 41], ["peas", 81],
  ["banana", 89], ["apple", 52], ["mango", 60], ["papaya", 43], ["guava", 68], ["orange", 47], ["grapes", 69], ["pomegranate", 83], ["watermelon", 30],
  ["almonds", 579], ["peanuts", 567], ["cashews", 553], ["dates", 277], ["sugar", 387], ["jaggery", 383], ["honey", 304],
];

// kcal for one standard serving: [min, max] from typical published values.
const SERVINGS: [key: string, min: number, max: number][] = [
  ["phulka", 70, 110], ["roti_ghee", 95, 140], ["plain_paratha", 180, 260], ["aloo_paratha", 250, 360], ["jowar_bhakri", 130, 200],
  ["steamed_rice", 180, 220], ["dal_tadka", 120, 200], ["rajma", 160, 240], ["chole", 180, 270], ["kadhi", 110, 180],
  ["idli", 110, 160], ["plain_dosa", 135, 200], ["masala_dosa", 250, 400], ["sambar", 90, 150], ["upma", 200, 300],
  ["kanda_poha", 220, 330], ["sabudana_khichdi", 350, 500], ["misal_pav", 500, 700], ["vada_pav", 280, 400], ["pav_bhaji", 400, 600],
  ["samosa", 230, 310], ["masala_chai", 60, 110], ["chaas", 30, 70], ["palak_paneer", 230, 330], ["chicken_curry", 220, 350],
  ["khichdi", 180, 280], ["puran_poli", 280, 400], ["plain_curd", 80, 110], ["boiled_eggs", 120, 170],
];

describe("food accuracy benchmark", () => {
  it.each(PER_100G)("%s is within 15%% of %i kcal/100 g", (key, kcal) => {
    const s = STAPLE_BY_KEY[key];
    expect(s, key).toBeDefined();
    const v = s.per100.calories!;
    expect(Math.abs(v - kcal) / kcal, `${key}: app ${v} vs reference ${kcal}`).toBeLessThanOrEqual(0.15);
  });

  it.each(SERVINGS)("%s per serving is %i–%i kcal", (key, min, max) => {
    const d = DISH_BY_KEY[key];
    expect(d, key).toBeDefined();
    const v = Math.round(dishNutrition(d).calories ?? 0);
    expect(v >= min && v <= max, `${key}: app ${v} kcal, expected ${min}–${max}`).toBe(true);
  });

  it("finds the plain food for everyday words", () => {
    for (const [query, key] of [["peru", "guava"], ["amrood", "guava"], ["kela", "banana"], ["toor dal", "toor"], ["dahi", "curd"], ["badam", "almonds"], ["anjeer", "fig_dried"], ["makhana", "makhana"], ["chaas", "buttermilk"]] as const) {
      expect(searchStaples(query).map((s) => s.key), query).toContain(key);
    }
  });

  it("never prefers a product over the plain food in database results", () => {
    const cases: [string, string[], string][] = [
      ["guava", ["Pastry, Pastelitos de Guava (guava pastries)", "Guava nectar, canned", "Guavas, common, raw"], "Guavas, common, raw"],
      ["banana", ["Bananas, dehydrated, or banana powder", "Babyfood, fruit, bananas", "Bananas, raw"], "Bananas, raw"],
      ["apple", ["Apple juice, canned or bottled, unsweetened", "Apples, raw, with skin"], "Apples, raw, with skin"],
      ["mango", ["Mango nectar, canned", "Mangos, raw"], "Mangos, raw"],
      ["spinach", ["Spinach souffle", "Spinach, raw"], "Spinach, raw"],
    ];
    for (const [q, names, want] of cases) expect(rankUsda(q, names.map((name) => ({ name })))[0].name, q).toBe(want);
  });
});
