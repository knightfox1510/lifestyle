import { describe, expect, it } from "vitest";
import { loggedRollingAverage, weekdayPattern, weeklyStats, weeklyTrend, type DayStats } from "@/modules/bladder/analysis";
import { pageIndex, searchPages } from "@/modules/search";
import { addDays } from "@/lib/dates";

const day = (date: string, leaks: number, logged = true): DayStats => ({ date, leaks, urges: logged ? 1 : 0, voids: logged ? 5 : 0, padChanges: 0, fluidMl: logged ? 1500 : 0, caffeineMl: 0, alcoholMl: 0, kegel: false, workouts: [], irritants: [] });

describe("bladder weekly view", () => {
  // 2026-10-05 is a Monday. Four weeks: 20, 15, 12, 9 leaks/day, with one unlogged day in week 2.
  const stats = [20, 15, 12, 9].flatMap((v, w) => Array.from({ length: 7 }, (_, i) => day(addDays("2026-10-05", w * 7 + i), w === 1 && i === 3 ? 0 : v, !(w === 1 && i === 3))));
  it("averages per logged day, Monday to Sunday", () => {
    const weeks = weeklyStats(stats);
    expect(weeks.map((w) => [w.start, w.days, w.perDay])).toEqual([["2026-10-05", 7, 20], ["2026-10-12", 6, 15], ["2026-10-19", 7, 12], ["2026-10-26", 7, 9]]);
    expect(weeks[1].change).toBe(-25);
  });
  it("fits a weekly trend", () => {
    const tr = weeklyTrend(weeklyStats(stats))!;
    expect(tr.weeks).toBe(4);
    expect(tr.perWeek).toBe(-3.6);
    expect(tr.pctPerWeek).toBe(-26);
  });
  it("skips unlogged days in the 7-day line", () => {
    const line = loggedRollingAverage([day("2026-10-01", 10), day("2026-10-02", 0, false), day("2026-10-03", 10), day("2026-10-04", 10)]);
    expect(line).toEqual([null, null, null, 10]);
  });
  it("averages by weekday", () => {
    expect(weekdayPattern(stats)[0]).toEqual({ name: "Mon", days: 4, perDay: 14 });
  });
});

describe("search", () => {
  it("finds screens by words people type", () => {
    const idx = pageIndex();
    expect(searchPages(idx, "bmi")[0].href).toBe("/body");
    expect(searchPages(idx, "week plan")[0].href).toBe("/food/plan");
    expect(searchPages(idx, "blood test").map((p) => p.href)).toContain("/medical/labs");
    expect(searchPages(idx, "turn off").map((p) => p.href)).toContain("/settings/features");
    expect(searchPages(idx, "")).toEqual([]);
  });
});
