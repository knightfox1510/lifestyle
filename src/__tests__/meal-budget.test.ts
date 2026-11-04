import { describe, expect, it } from "vitest";
import { mealBudgets } from "@/modules/food/meal-budget";

describe("calories per meal", () => {
  it("splits the goal by the usual shares when nothing is logged", () => {
    const b = mealBudgets(1800, {});
    expect(b.map((x) => [x.meal, x.budget, x.fits])).toEqual([["breakfast", 450, 450], ["lunch", 630, 630], ["snack", 180, 180], ["dinner", 540, 540]]);
  });
  it("spreads what's left over the meals still to come", () => {
    // A big breakfast and lunch leave 500 for snack + dinner (shares 0.1 : 0.3).
    const b = mealBudgets(1800, { breakfast: 600, lunch: 700 });
    expect(b.find((x) => x.meal === "snack")!.fits).toBe(130);
    expect(b.find((x) => x.meal === "dinner")!.fits).toBe(380);
    expect(b.find((x) => x.meal === "lunch")).toMatchObject({ eaten: 700, fits: null, budget: 630 });
  });
  it("counts 'other' food in the day but gives it no budget, and never goes below 0", () => {
    const b = mealBudgets(1500, { other: 1700 });
    expect(b.every((x) => x.fits === 0)).toBe(true);
    expect(b.some((x) => x.meal === "other")).toBe(false);
  });
});
