import { describe, expect, it } from "vitest";
import { coachCheckin } from "@/modules/coach/checkin";

describe("coach check-in", () => {
  it("compares the plan with the days since", () => {
    const f = coachCheckin(
      { calories_kcal: 1750, protein_g: 115, steps_per_day: 7500, expected_kg_per_week: -0.5, review_in_days: 21 },
      "2026-10-14",
      "2026-11-04",
      { foodByDay: [{ kcal: 1800, protein: 90 }, { kcal: 1700, protein: 100 }, { kcal: 1900, protein: 95 }, { kcal: 500, protein: 10 }], steps: [6000, 0, 7000], weights: [{ day: "2026-11-03", kg: 83.9 }, { day: "2026-10-15", kg: 85.1 }] },
    );
    expect(f).toEqual({ daysSince: 21, due: true, kcal: { planned: 1750, actual: 1800 }, protein: { planned: 115, actual: 95 }, steps: { planned: 7500, actual: 6500 }, weight: { change: -1.2, expected: -1.5 } });
  });
});
