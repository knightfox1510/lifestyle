import { describe, expect, it } from "vitest";
import { toGrams, unitsFor } from "@/modules/nutrition/measures";
import { STAPLE_BY_KEY } from "@/modules/nutrition/staples";
import { forGrams } from "@/modules/nutrition/nutrients";

const unit = (stapleKey: string, key: string) => unitsFor({ stapleKey }).find((u) => u.key === key)!;
const kcal = (stapleKey: string, grams: number) => Math.round(forGrams(STAPLE_BY_KEY[stapleKey].per100, grams).calories ?? 0);

describe("household measures", () => {
  it("counts only the edible part of fruit weighed whole", () => {
    // 200 g of banana with its peel is about 128 g of banana.
    expect(toGrams(200, unit("banana", "whole_g"))).toBe(128);
    expect(kcal("banana", toGrams(200, unit("banana", "whole_g")))).toBe(114);
    expect(toGrams(300, unit("watermelon", "whole_g"))).toBe(156);
    expect(unit("guava", "whole_g").note).toMatch(/5%/);
  });
  it("knows typical pieces", () => {
    expect(toGrams(1, unit("banana", "piece"))).toBe(118);
    expect(toGrams(2, unit("egg", "piece"))).toBe(100);
    expect(toGrams(10, unit("almonds", "piece"))).toBe(12);
  });
  it("turns ml and spoons into grams with the food's density", () => {
    expect(toGrams(250, unit("milk_toned", "ml"))).toBe(257.5);
    expect(toGrams(1, unit("ghee", "tbsp"))).toBe(13.7);
    expect(toGrams(2, unit("honey", "tbsp"))).toBe(42.6);
    // A cup of atta weighs far less than a cup of water.
    expect(toGrams(1, unit("atta", "cup"))).toBe(120);
    expect(toGrams(1, unit("rice_white", "cup"))).toBe(189.6);
  });
  it("uses label servings and falls back to 1 g/ml for unknown liquids", () => {
    const u = unitsFor({ servingG: 30, servingLabel: "1 scoop" });
    expect(u.find((x) => x.key === "serving")!.grams).toBe(30);
    expect(unitsFor({ liquid: true }).find((x) => x.key === "glass")!.grams).toBe(250);
    expect(unitsFor({}).some((x) => x.key === "whole_g" || x.key === "piece")).toBe(false);
  });
});
