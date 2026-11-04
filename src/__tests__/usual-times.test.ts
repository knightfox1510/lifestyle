import { describe, expect, it } from "vitest";
import { usualMealTimes } from "@/modules/food/usual-times";

describe("usual meal times", () => {
  it("median of the first entry per day, only with enough days", () => {
    const s = [
      ...[13 * 60, 13 * 60 + 30, 14 * 60, 13 * 60 + 15, 12 * 60 + 45].map((m, i) => ({ day: `2026-10-0${i + 1}`, meal: "lunch", minutes: m })),
      { day: "2026-10-01", meal: "lunch", minutes: 15 * 60 }, // a later snack-ish lunch item the same day doesn't count
      ...[8 * 60, 8 * 60 + 20].map((m, i) => ({ day: `2026-10-0${i + 1}`, meal: "breakfast", minutes: m })),
    ];
    expect(usualMealTimes(s)).toEqual({ lunch: 13 * 60 + 15 });
  });
});
