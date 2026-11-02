import { describe, expect, it } from "vitest";
import { dishKey, planWeek, usualMeals } from "@/modules/food/plan";
import { weekPlanSchema } from "@/lib/ai/phase2-schemas";
import { toGeminiSchema } from "@/lib/ai/schemas";

describe("week plan", () => {
  // 2026-11-02 is a Monday.
  it("starts the week on the shopping day", () => {
    expect(planWeek("2026-11-02", 6)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(planWeek("2026-11-02", 0)[0]).toBe("2026-11-01");
    expect(planWeek("2026-11-07", 6)[0]).toBe("2026-11-07"); // shopping day itself starts a new week
  });
  it("treats quantities and plurals as the same dish", () => {
    expect(dishKey("2 Rotis with ghee")).toBe(dishKey("roti with ghee"));
    expect(dishKey("1 katori of toor dal")).toBe(dishKey("Toor dal"));
    expect(dishKey("Kanda poha (1 plate)")).toBe("kanda poha");
  });
  it("learns usual meals per meal type, recent ones first", () => {
    const today = "2026-11-02";
    const u = usualMeals(
      [
        ...["2026-11-01", "2026-10-31", "2026-10-30"].map((date) => ({ title: "Poha", meal: "breakfast" as const, date })),
        ...["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"].map((date) => ({ title: "Upma", meal: "breakfast" as const, date })),
        { title: "2 rotis", meal: "dinner" as const, date: "2026-11-01" },
        { title: "Roti", meal: "dinner" as const, date: "2026-10-31" },
        { title: "Roti", meal: "dinner" as const, date: "2026-10-30" },
      ],
      today,
    );
    expect(u.breakfast.map((x) => x.title)).toEqual(["Poha", "Upma"]); // Upma was more often, but months ago
    expect(u.dinner).toHaveLength(1);
    expect(u.dinner[0]).toMatchObject({ title: "Roti", count: 3, lastDate: "2026-11-01" });
    expect(u.lunch).toEqual([]);
  });
  it("sends Gemini a schema it accepts", () => {
    expect(JSON.stringify(toGeminiSchema(weekPlanSchema))).not.toMatch(/"(max|min)Items"/);
  });
});

import { mergeIngredients, planDayTotals, planFor, portionFor } from "@/modules/food/plan";
import { activeAreaHref, AREAS } from "@/modules/areas";

describe("per-person plans", () => {
  const g = "g", k = "k";
  it("knows who a dish is for and their portion", () => {
    expect(planFor({ for_user: null }, [g, k])).toEqual([g, k]);
    expect(planFor({ for_user: k }, [g, k])).toEqual([k]);
    expect(portionFor({ portions: { g: 1.5 } }, g)).toBe(1.5);
    expect(portionFor({ portions: { g: 1.5 } }, k)).toBe(1);
  });
  it("totals each person's day from portions and recipe numbers", () => {
    const t = planDayTotals(
      [
        { kcal_per_serving: 400, protein_g: 20, portions: { g: 1.5, k: 1 } },
        { kcal_per_serving: 300, protein_g: 30, for_user: g },
        { recipe_id: "r1", portions: {} },
        { kcal_per_serving: null, for_user: k },
      ],
      [g, k],
      new Map([["r1", { kcal_per_serving: 500, protein_g: 25 }]]),
    );
    expect(t.g).toMatchObject({ kcal: 600 + 300 + 500, protein: 30 + 30 + 25, dishes: 3, unknown: 0 });
    expect(t.k).toMatchObject({ kcal: 400 + 500, protein: 45, dishes: 3, unknown: 1 });
  });
  it("merges one shopping list from many dishes", () => {
    const out = mergeIngredients([
      [{ name: "Onions", quantity: "500 g", category: "produce" }, { name: "Paneer", quantity: "200 g", category: "dairy" }],
      [{ name: "onion", quantity: "2", category: "produce" }],
    ]);
    expect(out).toEqual([
      { name: "Onions", quantity: "500 g + 2", category: "produce" },
      { name: "Paneer", quantity: "200 g", category: "dairy" },
    ]);
  });
});

describe("related features", () => {
  it("highlights the most specific shortcut", () => {
    expect(activeAreaHref("/food/plan", AREAS.food)).toBe("/food/plan");
    expect(activeAreaHref("/food/goals", AREAS.food)).toBe("/food");
    expect(activeAreaHref("/medicines/checks", AREAS.meds)).toBe("/medicines/checks");
    expect(activeAreaHref("/medicines/manage", AREAS.meds)).toBe("/medicines");
    expect(activeAreaHref("/settings", AREAS.meds)).toBeNull();
  });
});
