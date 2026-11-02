import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, lastNDays, localDate, localTime } from "@/lib/dates";
import { streak } from "@/lib/streak";
import { adherence, isScheduledOn, refillInfo, slotsForDay } from "@/modules/medicines/logic";
import { comparisons, dailyStats, leaksAfterCaffeine, physicalShare, trend, triggerCounts } from "@/modules/bladder/analysis";
import { guessCategory } from "@/modules/groceries/meta";
import type { BladderEvent, FluidIntake, Medicine, MedicineDose } from "@/lib/types";

const med = (over: Partial<Medicine> = {}): Medicine => ({
  id: "m1",
  owner_id: "u",
  created_by: "u",
  household_id: "h",
  name: "Med",
  strength: null,
  form: "tablet",
  dose_amount: 1,
  dose_unit: "tablet",
  instructions: null,
  times: ["08:00", "20:00"],
  days_of_week: null,
  start_date: "2026-10-01",
  end_date: null,
  stock_count: null,
  refill_threshold: null,
  reason: null,
  prescribed_by: null,
  active: true,
  include_in_ai: true,
  ...over,
});

const dose = (date: string, time: string, status: "taken" | "skipped" = "taken"): MedicineDose => ({
  id: `${date}${time}`,
  medicine_id: "m1",
  owner_id: "u",
  scheduled_date: date,
  scheduled_time: time,
  status,
  taken_at: `${date}T08:00:00Z`,
  logged_by: "u",
});

describe("dates", () => {
  it("formats local date/time in the person's timezone", () => {
    // 20:00 UTC is 01:30 next day in India
    expect(localDate("2026-11-01T20:00:00Z", "Asia/Kolkata")).toBe("2026-11-02");
    expect(localTime("2026-11-01T20:00:00Z", "Asia/Kolkata")).toBe("01:30");
  });
  it("does day arithmetic across months", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(lastNDays("2026-11-02", 3)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(dayOfWeek("2026-11-01")).toBe(0); // Sunday
  });
  it("counts streaks ending today or yesterday", () => {
    expect(streak(new Set(["2026-11-01", "2026-10-31", "2026-10-29"]), "2026-11-01")).toBe(2);
    expect(streak(new Set(["2026-10-31", "2026-10-30"]), "2026-11-01")).toBe(2);
    expect(streak(new Set(["2026-10-29"]), "2026-11-01")).toBe(0);
  });
});

describe("medicines", () => {
  it("respects start/end dates, weekdays and as-needed", () => {
    expect(isScheduledOn(med(), "2026-09-30")).toBe(false);
    expect(isScheduledOn(med({ end_date: "2026-10-05" }), "2026-10-06")).toBe(false);
    expect(isScheduledOn(med({ days_of_week: [1] }), "2026-11-02")).toBe(true); // Monday
    expect(isScheduledOn(med({ days_of_week: [1] }), "2026-11-01")).toBe(false);
    expect(isScheduledOn(med({ times: [] }), "2026-11-01")).toBe(false);
    expect(isScheduledOn(med({ active: false }), "2026-11-01")).toBe(false);
  });
  it("builds sorted slots and matches doses", () => {
    const slots = slotsForDay([med({ times: ["20:00", "08:00"] })], [dose("2026-11-01", "08:00")], "2026-11-01");
    expect(slots.map((s) => s.time)).toEqual(["08:00", "20:00"]);
    expect(slots[0].dose?.status).toBe("taken");
    expect(slots[1].dose).toBeNull();
  });
  it("computes adherence (skipped counts as missed)", () => {
    const a = adherence([med()], [dose("2026-11-01", "08:00"), dose("2026-11-01", "20:00", "skipped")], ["2026-11-01"]);
    expect(a).toEqual({ scheduled: 2, taken: 1, pct: 50 });
  });
  it("flags low stock by threshold or days left", () => {
    expect(refillInfo(med({ stock_count: 20 }))).toMatchObject({ daysLeft: 10, low: false });
    expect(refillInfo(med({ stock_count: 8 }))).toMatchObject({ daysLeft: 4, low: true });
    expect(refillInfo(med({ stock_count: 20, refill_threshold: 25 }))?.low).toBe(true);
    expect(refillInfo(med())).toBeNull();
  });
});

const ev = (at: string, kind: BladderEvent["kind"], triggers: BladderEvent["triggers"] = [], urgency: number | null = null): BladderEvent => ({
  id: at + kind,
  owner_id: "u",
  occurred_at: at,
  kind,
  amount: kind === "leak" ? "small" : null,
  urgency,
  triggers,
  pad_changed: false,
  notes: null,
});
const drink = (at: string, ml: number, caffeinated = false): FluidIntake => ({
  id: at,
  owner_id: "u",
  occurred_at: at,
  drink: caffeinated ? "coffee" : "water",
  volume_ml: ml,
  caffeinated,
});

describe("bladder analysis", () => {
  const tz = "Asia/Kolkata";
  const days = ["2026-10-31", "2026-11-01"];
  const events = [
    ev("2026-10-31T04:00:00Z", "leak", ["cough"]),
    ev("2026-10-31T05:00:00Z", "leak", ["lifting", "exercise"]),
    ev("2026-10-31T06:00:00Z", "void"),
    ev("2026-11-01T04:00:00Z", "leak", ["urgency"], 5),
    ev("2026-11-01T19:00:00Z", "leak", ["cough"]), // 00:30 on Nov 2 IST, outside range
  ];
  const fluids = [drink("2026-10-31T03:00:00Z", 300, true), drink("2026-11-01T03:00:00Z", 2000)];

  it("buckets by local day", () => {
    const s = dailyStats(days, events, fluids, tz);
    expect(s.map((d) => d.leaks)).toEqual([2, 1]);
    expect(s[0]).toMatchObject({ voids: 1, fluidMl: 300, caffeineMl: 300 });
    expect(s[1].fluidMl).toBe(2000);
  });
  it("counts triggers and leak types", () => {
    expect(triggerCounts(events)[0]).toMatchObject({ key: "cough", value: 2 });
    expect(physicalShare(events)).toEqual({ total: 4, physical: 3, urge: 1 });
  });
  it("finds leaks within 2h of caffeine", () => {
    expect(leaksAfterCaffeine(events, fluids)).toEqual({ total: 4, after: 2 });
  });
  it("compares workout days vs rest days", () => {
    const s = dailyStats(days, events, fluids, tz, [], [{ performed_on: "2026-10-31", kind: "gym", status: "done" }, { performed_on: "2026-11-01", kind: "yoga", status: "skipped" }]);
    expect(s[0].workouts).toEqual(["gym"]);
    expect(s[1].workouts).toEqual([]);
    const c = comparisons(s, []).find((x) => x.label === "Workouts")!;
    expect(c.a).toMatchObject({ value: 2, days: 1 });
    expect(c.b).toMatchObject({ value: 1, days: 1 });
  });
  it("compares caffeine vs non-caffeine days", () => {
    const c = comparisons(dailyStats(days, events, fluids, tz), []).find((x) => x.label === "Caffeine")!;
    expect(c.a).toMatchObject({ value: 2, days: 1 });
    expect(c.b).toMatchObject({ value: 1, days: 1 });
  });
  it("reports a trend only with enough days", () => {
    expect(trend(dailyStats(days, events, fluids, tz))).toBeNull();
    const many = lastNDays("2026-11-10", 8);
    const evs = many.flatMap((d, i) => Array.from({ length: i < 4 ? 4 : 2 }, (_, k) => ev(`${d}T0${k}:00:00Z`, "leak")));
    expect(trend(dailyStats(many, evs, [], "UTC"))).toEqual({ first: 4, second: 2, change: -50 });
  });
});

describe("grocery categories", () => {
  it("guesses common items", () => {
    expect(guessCategory("Milk")).toBe("dairy");
    expect(guessCategory("2kg onions")).toBe("produce");
    expect(guessCategory("Toor dal")).toBe("pantry");
    expect(guessCategory("Dishwasher tablets")).toBe("household");
    expect(guessCategory("Mystery item")).toBe("other");
  });
});
