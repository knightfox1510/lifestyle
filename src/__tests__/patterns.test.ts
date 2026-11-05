import { describe, expect, it } from "vitest";
import { findPatterns, type DayFacts } from "@/modules/patterns";

const day = (i: number) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);

describe("patterns", () => {
  it("finds that short nights come with more eating, and says how sure", () => {
    const days: DayFacts[] = Array.from({ length: 40 }, (_, i) => {
      const short = i % 2 === 0;
      return { day: day(i), sleepH: short ? 5.8 : 7.5, kcal: (short ? 2250 : 1900) + ((i * 37) % 120) - 60 };
    });
    const { found } = findPatterns(days);
    const p = found.find((x) => x.id === "sleep-kcal")!;
    expect(p.strength).toBe("clear");
    expect(p.a.n).toBe(20);
    expect(p.text).toMatch(/^After nights under 6½ h you eat about 3\d\d kcal more/);
  });

  it("stays quiet when the difference is within normal day-to-day noise", () => {
    const days: DayFacts[] = Array.from({ length: 40 }, (_, i) => ({ day: day(i), sleepH: i % 2 ? 5.8 : 7.5, kcal: 2000 + ((i * 211) % 600) - 300 }));
    expect(findPatterns(days).found.find((x) => x.id === "sleep-kcal")).toBeUndefined();
  });

  it("lists what needs more days, and uses the next day for sleep after steps", () => {
    const days: DayFacts[] = Array.from({ length: 30 }, (_, i) => ({ day: day(i), steps: i % 2 ? 9000 : 3000, sleepH: i % 2 ? 6.2 : 7.6 }));
    const r = findPatterns(days);
    // 9,000-step days are followed by 7.6 h nights; 3,000-step days by 6.2 h.
    expect(r.found.find((x) => x.id === "steps-sleep")).toMatchObject({ a: { mean: 7.6 }, b: { mean: 6.2 } });
    expect(r.needMore).toContain("caffeine-leaks");
  });
});

describe("medicine refills", () => {
  it("days left follow how often it's taken, with an order-by date and a month's supply", async () => {
    const { refillInfo } = await import("@/modules/medicines/logic");
    const base = { stock_count: 12, dose_amount: 1, times: ["08:00"], refill_threshold: null, days_of_week: null, repeat_every_days: null } as never;
    expect(refillInfo(base, "2026-11-05")).toMatchObject({ daysLeft: 12, low: false, orderBy: "2026-11-14", monthSupply: 30 });
    // Taken Mon/Wed/Fri: 12 tablets last 28 days.
    expect(refillInfo({ ...(base as object), days_of_week: [1, 3, 5] } as never, "2026-11-05")).toMatchObject({ daysLeft: 28, monthSupply: 13 });
    expect(refillInfo({ ...(base as object), stock_count: 4 } as never, "2026-11-05")).toMatchObject({ daysLeft: 4, low: true, orderBy: "2026-11-06" });
  });
});

describe("lab retests", () => {
  it("plans a re-check for out-of-range results, and a newer normal result closes it", async () => {
    const { retestsDue } = await import("@/modules/medical/labs");
    const lab = (marker: string, test_date: string, flag: string, value = 10) => ({ id: `${marker}${test_date}`, marker, test_date, flag, value, value_text: null, unit: "ng/mL", panel: null, ref_low: null, ref_high: null, ref_text: null }) as never;
    const r = retestsDue([lab("Vitamin D (25-OH)", "2026-07-01", "low"), lab("TSH", "2026-10-20", "high"), lab("Hb", "2026-06-01", "low"), lab("Hb", "2026-09-01", "normal")], "2026-11-05");
    expect(r.map((x) => [x.marker, x.due, x.status])).toEqual([
      ["Vitamin D (25-OH)", "2026-09-29", "due"],
      ["TSH", "2026-12-01", "later"],
    ]);
  });
});

describe("us card", () => {
  it("counts days this week you both closed, from Monday", async () => {
    const { jointWeek } = await import("@/modules/engagement/us");
    // 2026-11-05 is a Thursday: Mon 2nd … Thu 5th.
    const me = [{ date: "2026-11-02", closed: true }, { date: "2026-11-03", closed: false, closedAt: "x" }, { date: "2026-11-04", closed: true }, { date: "2026-11-01", closed: true }];
    const her = [{ date: "2026-11-02", closed: true }, { date: "2026-11-03", closed: true }, { date: "2026-11-04", closed: false }, { date: "2026-11-01", closed: true }];
    expect(jointWeek(me, her, "2026-11-05")).toEqual({ both: 2, goal: 5, daysSoFar: 4, reached: false });
  });
  it("hints kindly, and only at sensible hours", async () => {
    const { partnerHint } = await import("@/modules/engagement/us");
    expect(partnerHint({ name: "kari", now: "15:10", waterPct: 0.3, lastWater: "12:30", mealsLogged: 2, dosesLeftOverdue: 0 })).toBe("kari hasn't logged water since 12:30.");
    expect(partnerHint({ name: "kari", now: "15:10", waterPct: 0.3, lastWater: null, mealsLogged: 2, dosesLeftOverdue: 1 })).toBe("kari has 1 dose still to take.");
    expect(partnerHint({ name: "kari", now: "08:00", waterPct: 0, lastWater: null, mealsLogged: 0, dosesLeftOverdue: 0 })).toBeNull();
  });
});
