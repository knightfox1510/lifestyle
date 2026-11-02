import { describe, expect, it } from "vitest";
import { cycleStats, cycleStatus, leaksByPhase, periodsFrom, phaseOn, type CycleDay } from "@/modules/cycle/logic";
import { addDays } from "@/lib/dates";
import { afterExposures } from "@/modules/bladder/exposures";
import type { BladderEvent, FluidIntake } from "@/lib/types";

const period = (start: string, n: number, extra: Partial<CycleDay> = {}): CycleDay[] =>
  Array.from({ length: n }, (_, i) => ({ day: addDays(start, i), flow: i === 0 ? "heavy" : "light", symptoms: [], ...extra }));

describe("cycle tracker", () => {
  const days = [...period("2026-08-05", 5), ...period("2026-09-02", 4), ...period("2026-09-30", 5)];
  const periods = periodsFrom(days);
  it("groups bleeding days into periods; spotting alone isn't a period", () => {
    expect(periods.map((p) => [p.start, p.days])).toEqual([["2026-08-05", 5], ["2026-09-02", 4], ["2026-09-30", 5]]);
    expect(periodsFrom([{ day: "2026-10-10", flow: "spotting", symptoms: [] }])).toEqual([]);
    // Spotting the day before counts as part of it, but the period starts at the first real flow.
    expect(periodsFrom([{ day: "2026-10-09", flow: "spotting", symptoms: [] }, ...period("2026-10-10", 3)])[0]).toMatchObject({ start: "2026-10-10" });
  });
  it("learns the typical cycle and predicts the next period", () => {
    expect(cycleStats(periods)).toMatchObject({ cycle: 28, period: 5, known: true, cycles: 2, regular: true });
    const s = cycleStatus(periods, "2026-10-20");
    expect(s).toMatchObject({ cycleDay: 21, inPeriod: false, nextStart: "2026-10-28", daysUntilNext: 8, late: 0 });
    expect(s.fertile).toEqual({ start: "2026-10-09", end: "2026-10-15" });
    expect(cycleStatus(periods, "2026-11-02")).toMatchObject({ late: 5 });
  });
  it("works out phases", () => {
    expect(phaseOn(periods, "2026-09-03")).toBe("menstrual");
    expect(phaseOn(periods, "2026-09-08")).toBe("follicular");
    expect(phaseOn(periods, "2026-09-16")).toBe("ovulation");
    expect(phaseOn(periods, "2026-09-25")).toBe("luteal");
    expect(phaseOn(periods, "2026-07-01")).toBeNull();
  });
  it("averages leaks per phase over logged days only", () => {
    const leaks = new Map([["2026-09-25", 4], ["2026-09-26", 2], ["2026-09-08", 1]]);
    const r = leaksByPhase(periods, leaks, ["2026-09-25", "2026-09-26", "2026-09-08", "2026-09-09"]);
    expect(r.find((x) => x.phase === "luteal")).toEqual({ phase: "luteal", days: 2, avg: 3 });
    expect(r.find((x) => x.phase === "follicular")).toEqual({ phase: "follicular", days: 2, avg: 0.5 });
  });
});

describe("what happens after drinks", () => {
  const tz = "Asia/Kolkata";
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"];
  const at = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00+05:30`).toISOString();
  const fluids = days.flatMap((d) => [
    { id: `t${d}`, owner_id: "u", occurred_at: at(d, "08:00"), drink: "tea", volume_ml: 150, caffeinated: true },
    { id: `w${d}`, owner_id: "u", occurred_at: at(d, "13:00"), drink: "water", volume_ml: 250, caffeinated: false },
  ]) as FluidIntake[];
  // A leak ~40 min after every morning chai, nothing after water.
  const events = days.map((d) => ({ id: d, occurred_at: at(d, "08:40"), kind: "leak", urgency: 4, triggers: ["urgency"] })) as unknown as BladderEvent[];
  it("flags a drink that is usually followed by a leak", () => {
    const r = afterExposures(events, fluids, [], days, tz, 2);
    const tea = r.results.find((x) => x.key === "drink:tea")!;
    const water = r.results.find((x) => x.key === "drink:water")!;
    expect(tea).toMatchObject({ count: 6, rate: 1, likely: true, medianMinutes: 40 });
    expect(water).toMatchObject({ count: 6, rate: 0, likely: false });
    expect(r.usual).toBeGreaterThan(0);
    expect(r.usual!).toBeLessThan(0.3);
  });
});
