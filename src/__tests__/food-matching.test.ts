import { describe, expect, it } from "vitest";
import { plausibleKcal, rankUsda, usdaScore } from "@/modules/nutrition/usda-rank";
import { STAPLE_BY_KEY, searchStaples } from "@/modules/nutrition/staples";

describe("food matching", () => {
  it("puts the plain food ahead of things made from it", () => {
    const foods = [{ name: "Pastry, Pastelitos de Guava (guava pastries)" }, { name: "Guava nectar, canned" }, { name: "Guavas, common, raw" }, { name: "Guava sauce, cooked" }];
    expect(rankUsda("pink guava", foods)[0].name).toBe("Guavas, common, raw");
    expect(rankUsda("guava juice", [{ name: "Guavas, common, raw" }, { name: "Guava juice" }])[0].name).toBe("Guava juice");
    expect(usdaScore("almond milk", "Beverages, almond milk, unsweetened, shelf stable")).toBeGreaterThan(usdaScore("almond milk", "Beverages, almond milk, chocolate, ready-to-drink"));
  });
  it("rejects a match that's way off the AI's own estimate", () => {
    expect(plausibleKcal(379, 68)).toBe(false); // guava pastry vs guava
    expect(plausibleKcal(68, 60)).toBe(true);
    expect(plausibleKcal(15, 30)).toBe(true); // light foods get slack
    expect(plausibleKcal(379, null)).toBe(true); // no estimate: can't judge
  });
  it("knows common Indian fruits", () => {
    expect(STAPLE_BY_KEY.guava.per100.calories).toBe(68);
    expect(searchStaples("pink guava")[0].key).toBe("guava");
    expect(searchStaples("chiku")[0]?.key).toBe("chikoo");
    expect(searchStaples("sitaphal")[0].key).toBe("custard_apple");
  });
});

import { computeItem, disagreement, type CalcItem } from "@/modules/nutrition/compute";

describe("calculated vs AI estimate", () => {
  const item = (per100kcal: number, est: number): CalcItem => ({
    description: "Pink guava",
    quantity: "100 g",
    components: [{ name: "pink guava", grams: 100, per100: { calories: per100kcal, protein_g: 1, carbs_g: 10, fat_g: 1 } }],
    estimate: { calories: est, protein_g: 2.6, carbs_g: 14, fat_g: 1, fiber_g: 5 },
    irritants: [],
  });
  it("flags a big gap so the person can choose", () => {
    expect(disagreement(item(379, 68))).toEqual({ calculated: 379, ai: 68 });
    expect(disagreement(item(68, 60))).toBeNull();
    expect(disagreement(item(20, 35))).toBeNull(); // small absolute gap on a light food
  });
  it("uses the AI estimate when chosen", () => {
    const out = computeItem({ ...item(379, 68), useEstimate: true });
    expect(out).toMatchObject({ accuracy: "estimated", grams: 100 });
    expect(out.nutrients.calories).toBe(68);
    expect(disagreement({ ...item(379, 68), useEstimate: true })).toBeNull();
  });
});
