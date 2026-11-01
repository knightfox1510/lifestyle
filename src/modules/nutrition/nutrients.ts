/**
 * Nutrient model shared by food entries, recipes and foods. Macros live in
 * dedicated food_entries columns; everything else is stored in `micros`.
 * Food data is per 100 g; entries store the amount actually eaten.
 */
export const MACRO_KEYS = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const;
export const MICRO_KEYS = [
  "sugar_g",
  "sat_fat_g",
  "sodium_mg",
  "potassium_mg",
  "calcium_mg",
  "iron_mg",
  "magnesium_mg",
  "zinc_mg",
  "vit_a_mcg",
  "vit_c_mg",
  "vit_d_mcg",
  "b12_mcg",
  "folate_mcg",
] as const;
export const NUTRIENT_KEYS = [...MACRO_KEYS, ...MICRO_KEYS] as const;

export type MacroKey = (typeof MACRO_KEYS)[number];
export type MicroKey = (typeof MICRO_KEYS)[number];
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
/** Partial: a missing key means "unknown", not zero. */
export type Nutrients = Partial<Record<NutrientKey, number>>;

export const NUTRIENT_META: Record<NutrientKey, { label: string; unit: string }> = {
  calories: { label: "Calories", unit: "kcal" },
  protein_g: { label: "Protein", unit: "g" },
  carbs_g: { label: "Carbs", unit: "g" },
  fat_g: { label: "Fat", unit: "g" },
  fiber_g: { label: "Fibre", unit: "g" },
  sugar_g: { label: "Sugars", unit: "g" },
  sat_fat_g: { label: "Saturated fat", unit: "g" },
  sodium_mg: { label: "Sodium", unit: "mg" },
  potassium_mg: { label: "Potassium", unit: "mg" },
  calcium_mg: { label: "Calcium", unit: "mg" },
  iron_mg: { label: "Iron", unit: "mg" },
  magnesium_mg: { label: "Magnesium", unit: "mg" },
  zinc_mg: { label: "Zinc", unit: "mg" },
  vit_a_mcg: { label: "Vitamin A", unit: "µg" },
  vit_c_mg: { label: "Vitamin C", unit: "mg" },
  vit_d_mcg: { label: "Vitamin D", unit: "µg" },
  b12_mcg: { label: "Vitamin B12", unit: "µg" },
  folate_mcg: { label: "Folate", unit: "µg" },
};

const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

/** Nutrients for `grams` of a food given per-100 g values. */
export function forGrams(per100: Nutrients, grams: number): Nutrients {
  const out: Nutrients = {};
  for (const k of NUTRIENT_KEYS) {
    const v = per100[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = round((v * grams) / 100);
  }
  return out;
}

export function scale(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {};
  for (const k of NUTRIENT_KEYS) {
    const v = n[k];
    if (typeof v === "number") out[k] = round(v * factor);
  }
  return out;
}

/** Sums nutrient sets. A key is present if any part had it (unknowns are skipped). */
export function sum(parts: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const p of parts) {
    for (const k of NUTRIENT_KEYS) {
      const v = p[k];
      if (typeof v === "number") out[k] = (out[k] ?? 0) + v;
    }
  }
  for (const k of NUTRIENT_KEYS) if (typeof out[k] === "number") out[k] = round(out[k]!);
  return out;
}

export function splitMacros(n: Nutrients) {
  const micros: Partial<Record<MicroKey, number>> = {};
  for (const k of MICRO_KEYS) if (typeof n[k] === "number") micros[k] = n[k];
  return {
    calories: Math.round(n.calories ?? 0),
    protein_g: n.protein_g ?? 0,
    carbs_g: n.carbs_g ?? 0,
    fat_g: n.fat_g ?? 0,
    fiber_g: n.fiber_g ?? 0,
    micros,
  };
}

/** Merge food-entry columns + micros back into one nutrient set. */
export function fromEntry(e: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; micros?: Record<string, number> | null }): Nutrients {
  return {
    ...(e.calories != null ? { calories: Number(e.calories) } : {}),
    ...(e.protein_g != null ? { protein_g: Number(e.protein_g) } : {}),
    ...(e.carbs_g != null ? { carbs_g: Number(e.carbs_g) } : {}),
    ...(e.fat_g != null ? { fat_g: Number(e.fat_g) } : {}),
    ...(e.fiber_g != null ? { fiber_g: Number(e.fiber_g) } : {}),
    ...Object.fromEntries(Object.entries(e.micros ?? {}).filter(([k, v]) => (MICRO_KEYS as readonly string[]).includes(k) && typeof v === "number")),
  };
}

export type Sex = "female" | "male" | "other" | null;
export type Target = { amount: number; kind: "min" | "max"; note?: string };

/**
 * Approximate daily targets for adults, based on ICMR-NIN 2020 RDAs (India)
 * and WHO limits for sodium, potassium and saturated fat. When sex is
 * unknown, the higher of the two "min" targets is used.
 */
export function dailyTargets(sex: Sex, calories: number | null): Partial<Record<NutrientKey, Target>> {
  const f = sex === "female";
  const m = sex === "male";
  const pick = (male: number, female: number) => (m ? male : f ? female : Math.max(male, female));
  const kcal = calories ?? (m ? 2100 : 1800);
  return {
    fiber_g: { amount: Math.round((kcal / 2000) * 30), kind: "min", note: "ICMR: 30 g per 2000 kcal" },
    sat_fat_g: { amount: Math.round((kcal * 0.1) / 9), kind: "max", note: "under 10% of calories" },
    sodium_mg: { amount: 2000, kind: "max", note: "≈ 5 g salt (WHO)" },
    potassium_mg: { amount: 3510, kind: "min", note: "WHO" },
    calcium_mg: { amount: 1000, kind: "min" },
    iron_mg: { amount: pick(19, 29), kind: "min" },
    magnesium_mg: { amount: pick(440, 370), kind: "min" },
    zinc_mg: { amount: pick(17, 13.2), kind: "min" },
    vit_a_mcg: { amount: pick(1000, 840), kind: "min" },
    vit_c_mg: { amount: pick(80, 65), kind: "min" },
    vit_d_mcg: { amount: 15, kind: "min", note: "600 IU; sunlight also counts" },
    b12_mcg: { amount: 2.5, kind: "min" },
    folate_mcg: { amount: pick(300, 220), kind: "min" },
  };
}

export function formatNutrient(k: NutrientKey, v: number | undefined) {
  if (v === undefined) return "–";
  const meta = NUTRIENT_META[k];
  return `${v >= 100 ? Math.round(v).toLocaleString("en-IN") : Math.round(v * 10) / 10} ${meta.unit}`;
}
