import { describe, expect, it } from "vitest";
import { dayGoalInputs, skipKey } from "@/modules/engagement/day-goals";

const base = {
  enabled: { water: true, food: true, meds: true, checkin: true },
  waterMl: 1500,
  waterTarget: 2500,
  meals: new Set(["lunch", "dinner"]),
  slots: [{ medicineId: "m", time: "08:00", status: "taken" as const }, { medicineId: "m", time: "21:00", status: null }, { medicineId: "n", time: "08:00", status: "skipped" as const }],
  supps: [{ id: "d3", taken: true }, { id: "omega", taken: false }],
  checked: false,
  skipped: new Set<string>(),
};

describe("day goals with skips", () => {
  it("a dose logged as Skipped leaves the target; nothing else is skipped", () => {
    const r = dayGoalInputs(base);
    expect(r).toEqual([
      { key: "water", value: 1500, target: 2500 },
      { key: "food", value: 2, target: 3 },
      { key: "meds", value: 2, target: 4 },
      { key: "check", value: 0, target: 1 },
    ]);
  });
  it("skipped on purpose: fasting breakfast, omega, the night dose, water and the check-in leave the goals", () => {
    const r = dayGoalInputs({ ...base, skipped: new Set([skipKey.meal("breakfast"), skipKey.supp("omega"), skipKey.dose("m", "21:00"), skipKey.water, skipKey.check]) });
    expect(r).toEqual([
      { key: "food", value: 2, target: 2 },
      { key: "meds", value: 2, target: 2 },
    ]);
  });
  it("a meal logged anyway still counts even if it was marked skipped", () => {
    const r = dayGoalInputs({ ...base, skipped: new Set([skipKey.meal("lunch")]) });
    expect(r.find((x) => x.key === "food")).toEqual({ key: "food", value: 2, target: 3 });
  });
});
