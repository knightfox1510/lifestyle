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
