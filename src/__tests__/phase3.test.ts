import { describe, expect, it } from "vitest";
import { inQuietHours, inWindow, shouldRemind, toMinutes } from "@/modules/notifications/timing";
import { monthlyCost, nextRenewal } from "@/modules/subscriptions/logic";
import { IAP_SCHEDULE, ageLabel, durationLabel } from "@/modules/child/vaccines";
import { classesOn } from "@/modules/fitness/meta";
import type { FitnessClass } from "@/lib/types";

describe("reminder timing", () => {
  it("fires within the window after the target", () => {
    expect(inWindow("08:00", toMinutes("08:00"))).toBe(true);
    expect(inWindow("08:14", toMinutes("08:00"))).toBe(true);
    expect(inWindow("08:15", toMinutes("08:00"))).toBe(false);
    expect(inWindow("07:59", toMinutes("08:00"))).toBe(false);
  });
  it("handles reminders before midnight for early classes", () => {
    // 00:30 class with a 60-minute reminder → 23:30 the previous day.
    expect(inWindow("23:35", toMinutes("00:30") - 60)).toBe(true);
    expect(inWindow("00:05", toMinutes("23:55"))).toBe(true);
  });
  it("respects quiet hours, including overnight ranges", () => {
    expect(inQuietHours("23:30", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("06:59", "22:00:00", "07:00:00")).toBe(true);
    expect(inQuietHours("07:00", "22:00", "07:00")).toBe(false);
    expect(inQuietHours("13:00", "13:00", "15:00")).toBe(true);
    expect(inQuietHours("13:00", null, null)).toBe(false);
  });
  it("sends expiry reminders at sensible thresholds only", () => {
    expect(shouldRemind(60, 60)).toBe(true);
    expect(shouldRemind(59, 60)).toBe(false);
    expect(shouldRemind(30, 60)).toBe(true);
    expect(shouldRemind(7, 60)).toBe(true);
    expect(shouldRemind(30, 14)).toBe(false); // beyond the chosen lead time
    expect(shouldRemind(0, 60)).toBe(true);
    expect(shouldRemind(-1, 60)).toBe(true);
    expect(shouldRemind(-2, 60)).toBe(false);
  });
});

describe("subscriptions", () => {
  it("advances renewal dates by cycle, clamping month ends", () => {
    expect(nextRenewal("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextRenewal("2026-11-15", "quarterly")).toBe("2027-02-15");
    expect(nextRenewal("2026-11-01", "weekly")).toBe("2026-11-08");
    expect(nextRenewal("2024-02-29", "yearly")).toBe("2025-02-28");
  });
  it("normalises cost per month", () => {
    expect(monthlyCost({ cost: 1499, billing_cycle: "yearly" })).toBeCloseTo(124.92, 1);
    expect(monthlyCost({ cost: 649, billing_cycle: "monthly" })).toBe(649);
    expect(monthlyCost({ cost: null, billing_cycle: "monthly" })).toBe(0);
  });
});

describe("child", () => {
  it("formats ages", () => {
    expect(ageLabel("2026-10-01", "2026-11-01")).toBe("4 weeks");
    expect(ageLabel("2026-04-01", "2026-11-01")).toBe("7 months");
    expect(ageLabel("2023-05-01", "2026-11-01")).toBe("3 years 6 mo");
  });
  it("has a schedule starting at birth", () => {
    expect(IAP_SCHEDULE.filter((v) => v.ageDays === 0).map((v) => v.vaccine)).toContain("BCG");
    expect(durationLabel(95 * 60000)).toBe("1h 35m");
  });
});

describe("fitness", () => {
  it("lists active classes for a weekday in time order", () => {
    const base = { owner_id: "u", kind: "gym", duration_minutes: 60, location: null, instructor: null, remind_minutes_before: 60, notes: null } as const;
    const classes = [
      { ...base, id: "a", name: "Evening yoga", days_of_week: [1], start_time: "18:00", active: true },
      { ...base, id: "b", name: "Morning gym", days_of_week: [1, 3], start_time: "07:30", active: true },
      { ...base, id: "c", name: "Paused", days_of_week: [1], start_time: "06:00", active: false },
    ] as FitnessClass[];
    expect(classesOn(classes, "2026-11-02").map((c) => c.id)).toEqual(["b", "a"]); // Monday
    expect(classesOn(classes, "2026-11-03")).toEqual([]);
  });
});
