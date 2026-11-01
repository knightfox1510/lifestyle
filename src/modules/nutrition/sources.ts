import { NUTRIENT_KEYS, type Nutrients, type NutrientKey } from "./nutrients";

/**
 * Parsers for public food databases (pure, unit-tested):
 *  - USDA FoodData Central (public domain): https://fdc.nal.usda.gov
 *  - Open Food Facts (ODbL): https://world.openfoodfacts.org
 */

// FDC nutrient numbers → our keys (amounts are per 100 g for Foundation/SR Legacy).
const FDC_NUMBERS: Record<string, NutrientKey> = {
  "208": "calories",
  "203": "protein_g",
  "205": "carbs_g",
  "204": "fat_g",
  "291": "fiber_g",
  "269": "sugar_g",
  "606": "sat_fat_g",
  "307": "sodium_mg",
  "306": "potassium_mg",
  "301": "calcium_mg",
  "303": "iron_mg",
  "304": "magnesium_mg",
  "309": "zinc_mg",
  "320": "vit_a_mcg",
  "401": "vit_c_mg",
  "328": "vit_d_mcg",
  "418": "b12_mcg",
  "435": "folate_mcg",
};
// Foundation foods sometimes only report Atwater energy.
const FDC_ENERGY_FALLBACK = ["957", "958"];

export type FdcSearchFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  brandName?: string;
  // Search results use nutrientNumber/value; /food/{id}?format=abridged uses number/amount.
  foodNutrients?: { nutrientNumber?: string; number?: string; nutrientName?: string; name?: string; unitName?: string; value?: number; amount?: number }[];
};

export function parseFdcFood(food: FdcSearchFood): { id: string; name: string; per100: Nutrients; dataType: string } {
  const per100: Nutrients = {};
  let fallbackKcal: number | undefined;
  for (const n of food.foodNutrients ?? []) {
    const num = n.nutrientNumber ?? n.number;
    const value = n.value ?? n.amount;
    if (typeof value !== "number" || !num) continue;
    const key = FDC_NUMBERS[num];
    if (key === "calories" && n.unitName && n.unitName.toUpperCase() !== "KCAL") continue;
    if (key) per100[key] = value;
    else if (FDC_ENERGY_FALLBACK.includes(num) && n.unitName?.toUpperCase() === "KCAL") fallbackKcal ??= value;
  }
  if (per100.calories === undefined && fallbackKcal !== undefined) per100.calories = fallbackKcal;
  return { id: String(food.fdcId), name: food.description, per100, dataType: food.dataType ?? "" };
}

// Open Food Facts stores minerals/vitamins in grams per 100 g.
const OFF_MAP: [string, NutrientKey, number][] = [
  ["energy-kcal_100g", "calories", 1],
  ["proteins_100g", "protein_g", 1],
  ["carbohydrates_100g", "carbs_g", 1],
  ["fat_100g", "fat_g", 1],
  ["fiber_100g", "fiber_g", 1],
  ["sugars_100g", "sugar_g", 1],
  ["saturated-fat_100g", "sat_fat_g", 1],
  ["sodium_100g", "sodium_mg", 1000],
  ["potassium_100g", "potassium_mg", 1000],
  ["calcium_100g", "calcium_mg", 1000],
  ["iron_100g", "iron_mg", 1000],
  ["magnesium_100g", "magnesium_mg", 1000],
  ["zinc_100g", "zinc_mg", 1000],
  ["vitamin-a_100g", "vit_a_mcg", 1_000_000],
  ["vitamin-c_100g", "vit_c_mg", 1000],
  ["vitamin-d_100g", "vit_d_mcg", 1_000_000],
  ["vitamin-b12_100g", "b12_mcg", 1_000_000],
  ["folates_100g", "folate_mcg", 1_000_000],
];

export type OffProduct = {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
  ingredients_text?: string;
};

export function parseOffProduct(p: OffProduct) {
  const per100: Nutrients = {};
  const nm = p.nutriments ?? {};
  for (const [field, key, factor] of OFF_MAP) {
    const raw = nm[field];
    const v = typeof raw === "string" ? Number(raw) : raw;
    if (typeof v === "number" && Number.isFinite(v)) per100[key] = Math.round(v * factor * 100) / 100;
  }
  // Some products only give energy in kJ.
  if (per100.calories === undefined) {
    const kj = Number(nm["energy_100g"] ?? nm["energy-kj_100g"]);
    if (Number.isFinite(kj) && kj > 0) per100.calories = Math.round(kj / 4.184);
  }
  // Sodium may be missing while salt is present (salt = sodium × 2.5).
  if (per100.sodium_mg === undefined) {
    const salt = Number(nm["salt_100g"]);
    if (Number.isFinite(salt)) per100.sodium_mg = Math.round((salt / 2.5) * 1000);
  }
  const servingG = Number(p.serving_quantity);
  const ing = (p.ingredients_text ?? "").toLowerCase();
  const irritants = [
    /sucralose|aspartame|acesulfame|saccharin|stevia/.test(ing) ? "sweetener" : null,
    /caffeine|coffee/.test(ing) ? "caffeine" : null,
    /cocoa|chocolate/.test(ing) ? "chocolate" : null,
    /chilli|chili|pepper extract|capsicum oleoresin/.test(ing) ? "spicy" : null,
    /carbonated/.test(ing) ? "carbonated" : null,
  ].filter(Boolean) as string[];
  return {
    name: [p.product_name, p.brands ? `(${p.brands.split(",")[0].trim()})` : ""].filter(Boolean).join(" ").trim() || "Product",
    brand: p.brands?.split(",")[0].trim() || null,
    per100,
    serving_g: Number.isFinite(servingG) && servingG > 0 ? servingG : null,
    serving_label: p.serving_size ?? null,
    irritants,
  };
}

export function hasCoreNutrients(n: Nutrients) {
  return typeof n.calories === "number" && (["protein_g", "carbs_g", "fat_g"] as const).every((k) => typeof n[k] === "number");
}

export const ALL_KEYS = NUTRIENT_KEYS;
