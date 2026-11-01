import { describe, expect, it } from "vitest";
import { dailyTargets, forGrams, fromEntry, scale, splitMacros, sum } from "@/modules/nutrition/nutrients";
import { STAPLES, searchStaples, STAPLE_BY_KEY } from "@/modules/nutrition/staples";
import { computeItem } from "@/modules/nutrition/compute";
import { parseFdcFood, parseOffProduct } from "@/modules/nutrition/sources";
import { labNutrientLinks } from "@/modules/nutrition/labs-link";
import { cleanIrritants } from "@/modules/nutrition/irritants";
import { comparisons, dailyStats } from "@/modules/bladder/analysis";

describe("nutrient maths", () => {
  it("scales per-100 g data to grams and keeps unknowns unknown", () => {
    const n = forGrams({ calories: 340, protein_g: 13.2, iron_mg: 3.6 }, 60);
    expect(n).toEqual({ calories: 204, protein_g: 7.9, iron_mg: 2.2 });
    expect(n.vit_d_mcg).toBeUndefined();
  });
  it("sums and scales", () => {
    expect(sum([{ calories: 100, iron_mg: 1 }, { calories: 50 }])).toEqual({ calories: 150, iron_mg: 1 });
    expect(scale({ calories: 300, protein_g: 10 }, 0.5)).toEqual({ calories: 150, protein_g: 5 });
  });
  it("splits macros into columns and micros into jsonb, and back", () => {
    const s = splitMacros({ calories: 204.4, protein_g: 7.9, iron_mg: 2.2, sodium_mg: 5 });
    expect(s).toEqual({ calories: 204, protein_g: 7.9, carbs_g: 0, fat_g: 0, fiber_g: 0, micros: { iron_mg: 2.2, sodium_mg: 5 } });
    expect(fromEntry({ calories: 204, protein_g: 7.9, carbs_g: null, fat_g: null, fiber_g: null, micros: { iron_mg: 2.2, junk: 3 } })).toEqual({ calories: 204, protein_g: 7.9, iron_mg: 2.2 });
  });
  it("uses Indian RDAs by sex", () => {
    expect(dailyTargets("female", 1800).iron_mg?.amount).toBe(29);
    expect(dailyTargets("male", 2200).iron_mg?.amount).toBe(19);
    expect(dailyTargets(null, null).iron_mg?.amount).toBe(29);
    expect(dailyTargets("female", 2000).fiber_g?.amount).toBe(30);
    expect(dailyTargets("female", 1800).sodium_mg).toMatchObject({ amount: 2000, kind: "max" });
  });
});

describe("built-in staples", () => {
  it("are internally consistent (energy ≈ 4P + 4C + 9F)", () => {
    for (const s of STAPLES) {
      const { calories, protein_g, carbs_g, fat_g } = s.per100;
      expect(calories, s.key).toBeTypeOf("number");
      if (s.key === "salt") continue;
      // Total-carb and net-carb (minus fibre) Atwater estimates; real values use food-specific
      // factors, so accept either within tolerance. Still catches typos like a misplaced digit.
      const fibre = s.per100.fiber_g ?? 0;
      const total = 4 * (protein_g ?? 0) + 4 * (carbs_g ?? 0) + 9 * (fat_g ?? 0);
      const net = total - 4 * fibre;
      const ok = [total, net].some((a) => Math.abs(a - calories!) <= 10 || Math.abs(a - calories!) / calories! < 0.25);
      expect(ok, `${s.key}: ${calories} kcal vs ${Math.round(total)} / ${Math.round(net)}`).toBe(true);
    }
  });
  it("are searchable by Hindi/common names", () => {
    expect(searchStaples("toor dal")[0].key).toBe("toor");
    expect(searchStaples("atta")[0].key).toBe("atta");
    expect(searchStaples("palak")[0].key).toBe("spinach");
    expect(STAPLE_BY_KEY.green_chilli.irritants).toContain("spicy");
  });
});

describe("meal calculation", () => {
  const base = { description: "2 phulka", quantity: null, estimate: { calories: 999, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, irritants: [] };
  it("calculates from ingredients when all are matched", () => {
    const r = computeItem({ ...base, components: [{ name: "atta", grams: 60, per100: STAPLE_BY_KEY.atta.per100 }, { name: "ghee", grams: 5, per100: STAPLE_BY_KEY.ghee.per100 }] });
    expect(r.accuracy).toBe("calculated");
    expect(r.nutrients.calories).toBe(248); // 204 + 43.8
    expect(r.nutrients.iron_mg).toBe(2.2);
    expect(r.grams).toBe(65);
  });
  it("falls back to the AI estimate if any ingredient is unmatched", () => {
    const r = computeItem({ ...base, components: [{ name: "atta", grams: 60, per100: STAPLE_BY_KEY.atta.per100 }, { name: "mystery", grams: 10, per100: null }] });
    expect(r.accuracy).toBe("estimated");
    expect(r.nutrients.calories).toBe(999);
    expect(r.nutrients.iron_mg).toBeUndefined();
  });
  it("uses a saved recipe's per-serving nutrition", () => {
    const r = computeItem({ ...base, components: [], recipe: { id: "r", title: "Dal", servings: 1.5, perServing: { calories: 200, protein_g: 10, iron_mg: 2 }, servingG: 250 } });
    expect(r).toEqual({ accuracy: "calculated", nutrients: { calories: 300, protein_g: 15, iron_mg: 3 }, grams: 375 });
  });
});

describe("food database parsers", () => {
  it("reads USDA search results (nutrientNumber/value)", () => {
    const p = parseFdcFood({
      fdcId: 172420,
      description: "Lentils, raw",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientNumber: "208", unitName: "KCAL", value: 352 },
        { nutrientNumber: "268", unitName: "kJ", value: 1473 },
        { nutrientNumber: "203", unitName: "G", value: 24.6 },
        { nutrientNumber: "303", unitName: "MG", value: 6.51 },
        { nutrientNumber: "435", unitName: "UG", value: 479 },
      ],
    });
    expect(p).toMatchObject({ id: "172420", name: "Lentils, raw", per100: { calories: 352, protein_g: 24.6, iron_mg: 6.51, folate_mcg: 479 } });
  });
  it("reads USDA abridged food details (number/amount) and Atwater energy", () => {
    const p = parseFdcFood({ fdcId: 1, description: "Paneer-like cheese", foodNutrients: [{ number: "957", unitName: "KCAL", amount: 290 }, { number: "204", unitName: "G", amount: 22 }] });
    expect(p.per100).toEqual({ calories: 290, fat_g: 22 });
  });
  it("reads Open Food Facts products, converting units", () => {
    const p = parseOffProduct({
      product_name: "Whole Wheat Atta",
      brands: "Aashirvaad, ITC",
      serving_quantity: "40",
      serving_size: "40 g",
      nutriments: { "energy-kcal_100g": 360, proteins_100g: 12, carbohydrates_100g: 72, fat_100g: 2, salt_100g: 0.05, "iron_100g": 0.0039, "vitamin-d_100g": 0.0000025 },
      ingredients_text: "Whole wheat",
    });
    expect(p.name).toBe("Whole Wheat Atta (Aashirvaad)");
    expect(p.serving_g).toBe(40);
    expect(p.per100).toMatchObject({ calories: 360, iron_mg: 3.9, vit_d_mcg: 2.5, sodium_mg: 20 });
  });
  it("detects irritants from ingredients and kJ-only energy", () => {
    const p = parseOffProduct({ product_name: "Diet cola", nutriments: { energy_100g: 4.184 }, ingredients_text: "Carbonated water, caffeine, aspartame" });
    expect(p.per100.calories).toBe(1);
    expect(p.irritants.sort()).toEqual(["caffeine", "carbonated", "sweetener"]);
  });
});

describe("links and tags", () => {
  it("links out-of-range labs to nutrients (latest result wins)", () => {
    const m = labNutrientLinks([
      { marker: "Vitamin D (25-OH)", value: 18, unit: "ng/mL", flag: "low", test_date: "2026-10-01" },
      { marker: "Ferritin", value: 9, unit: "ng/mL", flag: "low", test_date: "2026-01-01" },
      { marker: "ferritin", value: 40, unit: "ng/mL", flag: "normal", test_date: "2026-09-01" },
    ]);
    expect(m.get("vit_d_mcg")).toMatchObject({ flag: "low", value: "18 ng/mL" });
    expect(m.has("iron_mg")).toBe(false);
  });
  it("cleans irritant lists", () => {
    expect(cleanIrritants(["spicy", "spicy", "nope", 3])).toEqual(["spicy"]);
  });
  it("compares leaks on high-irritant days", () => {
    const days = ["2026-11-01", "2026-11-02", "2026-11-03"];
    const leak = (d: string) => ({ id: d, owner_id: "u", occurred_at: `${d}T06:00:00Z`, kind: "leak" as const, amount: null, urgency: null, triggers: [], pad_changed: false, notes: null });
    const events = [leak("2026-11-01"), leak("2026-11-01"), leak("2026-11-03")];
    const foods = [
      { eaten_at: "2026-11-01T07:00:00Z", irritants: ["spicy", "tomato"] },
      { eaten_at: "2026-11-02T07:00:00Z", irritants: ["spicy"] },
    ];
    const stats = dailyStats(days, events, [], "UTC", [], [], foods);
    expect(stats[0].irritants).toEqual(["spicy", "tomato"]);
    const c = comparisons(stats, []);
    expect(c.find((x) => x.label === "Bladder irritants")).toMatchObject({ a: { value: 2, days: 1 } });
    // Day 2 has food but no bladder entries, so it isn't counted as a logged day.
    expect(c.find((x) => x.label === "Spicy food")).toMatchObject({ a: { value: 2, days: 1 }, b: { value: 1, days: 1 } });
  });
});
