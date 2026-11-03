import { describe, expect, it } from "vitest";
import { describeRepeat, frequencyOf, isDueOn, nextDueOn } from "@/modules/schedule";
import { isScheduledOn } from "@/modules/medicines/logic";
import { timingTimes } from "@/modules/supplements/meta";
import type { Medicine } from "@/lib/types";

// 2026-11-02 is a Monday.
describe("how often", () => {
  it("every day, chosen weekdays, once a week", () => {
    expect(isDueOn({}, "2026-11-04")).toBe(true);
    expect(isDueOn({ days_of_week: [1, 3, 5] }, "2026-11-04")).toBe(true); // Wed
    expect(isDueOn({ days_of_week: [1, 3, 5] }, "2026-11-05")).toBe(false); // Thu
    expect(isDueOn({ days_of_week: [0] }, "2026-11-08")).toBe(true); // Sun
    expect(describeRepeat({ days_of_week: [0] })).toBe("Weekly on Sunday");
    expect(describeRepeat({ days_of_week: [5, 1, 3] })).toBe("Mon, Wed, Fri");
  });
  it("every N days from the start", () => {
    const r = { repeat_every_days: 14, start: "2026-11-02" };
    expect(isDueOn(r, "2026-11-02")).toBe(true);
    expect(isDueOn(r, "2026-11-09")).toBe(false);
    expect(isDueOn(r, "2026-11-16")).toBe(true);
    expect(isDueOn(r, "2026-11-01")).toBe(false); // before it started
    expect(nextDueOn(r, "2026-11-03")).toBe("2026-11-16");
    expect(frequencyOf(r)).toBe("every_n");
    expect(describeRepeat({ repeat_every_days: 30 })).toBe("Every 30 days");
  });
  it("applies to medicines", () => {
    const med = { active: true, times: ["09:00"], start_date: "2026-11-02", end_date: null, days_of_week: null, repeat_every_days: 7 } as unknown as Medicine;
    expect(isScheduledOn(med, "2026-11-09")).toBe(true);
    expect(isScheduledOn(med, "2026-11-10")).toBe(false);
    expect(isScheduledOn({ ...med, repeat_every_days: null }, "2026-11-10")).toBe(true);
  });
  it("uses my own supplement times over the defaults", () => {
    const t = timingTimes({ morning: "06:45", bedtime: "23:00", afternoon: "nonsense" });
    expect(t).toMatchObject({ morning: "06:45", bedtime: "23:00", afternoon: "15:00", with_meal: "13:30", post_workout: null });
    expect(timingTimes({ post_workout: "18:30" }).post_workout).toBe("18:30");
  });
});
