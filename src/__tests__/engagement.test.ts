import { describe, expect, it } from "vitest";
import { streak, streakWithRest } from "@/lib/streak";
import { addDays } from "@/lib/dates";
import { dayClosed, dayScore, newMilestones, nextUp, rings, waterPace, type MilestoneStats } from "@/modules/engagement/rings";

const days = (today: string, offsets: number[]) => new Set(offsets.map((o) => addDays(today, -o)));
// 2026-11-06 is a Thursday.
const TODAY = "2026-11-06";

describe("rings", () => {
  it("computes completion and the closed day", () => {
    const rs = rings([{ key: "water", value: 1000, target: 2000 }, { key: "meds", value: 2, target: 2 }, { key: "food", value: 1, target: 0 }]);
    expect(rs.map((r) => r.key)).toEqual(["water", "meds"]); // no target → no ring
    // water 2 of 4 half-litres + 2 of 2 doses = 4 of 6 things
    expect(dayScore(rs)).toBe(67);
    expect(dayClosed(rs)).toBe(false);
    expect(dayClosed(rings([{ key: "water", value: 2500, target: 2000 }]))).toBe(true);
    expect(dayClosed([])).toBe(false);
  });
  it("doesn't jump ahead when one small ring is done early", () => {
    // Morning: the one daily tablet, breakfast and a glass of water.
    const morning = rings([
      { key: "water", value: 200, target: 2000 },
      { key: "food", value: 1, target: 3 },
      { key: "meds", value: 1, target: 1 },
      { key: "check", value: 0, target: 1 },
    ]);
    expect(dayScore(morning)).toBe(27); // 0.4 + 1 + 1 of 9 things (was 36% as an average of rings)
  });
  it("paces water across the day", () => {
    expect(waterPace("07:00", "08:00", "20:00", 2400)).toBe(0);
    expect(waterPace("14:00", "08:00", "20:00", 2400)).toBe(1200);
    expect(waterPace("21:00", "08:00", "20:00", 2400)).toBe(2400);
  });
});

describe("next up", () => {
  const base = { dueDoses: [], water: null, mealsLogged: null, checkinDone: null };
  it("puts overdue doses first and skips far-off ones", () => {
    const items = nextUp({ ...base, now: "10:30", dueDoses: [{ medicineId: "b", name: "Shelcal", strength: null, time: "14:00" }, { medicineId: "a", name: "Thyronorm", strength: null, time: "07:00" }, { medicineId: "c", name: "Night", strength: null, time: "21:00" }] });
    expect(items.map((i) => (i.kind === "dose" ? [i.name, i.overdue] : i.kind))).toEqual([["Thyronorm", true]]);
  });
  it("nudges water only when clearly behind, the current meal and the evening check-in", () => {
    const items = nextUp({ now: "13:00", dueDoses: [], water: { ml: 400, target: 2400, start: "08:00", end: "20:00" }, mealsLogged: ["breakfast"], checkinDone: false });
    expect(items.map((i) => i.kind)).toEqual(["water", "meal"]);
    const evening = nextUp({ now: "20:00", dueDoses: [], water: { ml: 2400, target: 2400, start: "08:00", end: "20:00" }, mealsLogged: ["breakfast", "lunch", "dinner"], checkinDone: false });
    expect(evening.map((i) => i.kind)).toEqual(["check"]);
  });
});

describe("streaks", () => {
  it("counts consecutive days and ignores an unlogged today", () => {
    expect(streak(days(TODAY, [0, 1, 2]), TODAY)).toBe(3);
    expect(streakWithRest(days(TODAY, [1, 2, 3]), TODAY)).toBe(3);
  });
  it("forgives one missed day per week", () => {
    // Thu..Mon logged except Tue (offset 2): one rest day this week.
    expect(streakWithRest(days(TODAY, [0, 1, 3, 4]), TODAY)).toBe(4);
    expect(streak(days(TODAY, [0, 1, 3, 4]), TODAY)).toBe(2);
    // Two misses in the same week break it.
    expect(streakWithRest(days(TODAY, [0, 2, 4]), TODAY)).toBe(2);
    // Misses in different weeks are each forgiven (offset 2 = Tue, offset 6 = Fri of the previous week).
    expect(streakWithRest(days(TODAY, [0, 1, 3, 4, 5, 7, 8]), TODAY)).toBe(7);
  });
  it("covers yesterday when today isn't logged yet", () => {
    expect(streakWithRest(days(TODAY, [2, 3, 4]), TODAY)).toBe(3);
    expect(streakWithRest(new Set(), TODAY)).toBe(0);
  });
});

describe("milestones", () => {
  const s: MilestoneStats = { streak: 7, closedDays: 1, dosesTaken: 10, mealsLogged: 60, waterTargetDays7: 3, bladderLoggedDays7: 6, leaks7: 0 };
  it("finds new ones only", () => {
    expect(newMilestones(s, new Set()).map((m) => m.key)).toEqual(["first_close", "streak_7", "meals_50", "leak_free_week"]);
    expect(newMilestones(s, new Set(["first_close", "streak_7", "meals_50", "leak_free_week"]))).toEqual([]);
  });
  it("needs enough bladder logging for a leak-free week", () => {
    expect(newMilestones({ ...s, bladderLoggedDays7: 2 }, new Set()).map((m) => m.key)).not.toContain("leak_free_week");
    expect(newMilestones({ ...s, bladderLoggedDays7: null, leaks7: null }, new Set()).map((m) => m.key)).not.toContain("leak_free_week");
  });
});

describe("supplements in next up", () => {
  const base = { dueDoses: [], water: null, mealsLogged: null, checkinDone: null };
  const supps = [
    { supplementId: "d3", name: "Vitamin D3", dose: "1 tab", time: "08:00" },
    { supplementId: "mg", name: "Magnesium", dose: null, time: "22:00" },
    { supplementId: "whey", name: "Whey", dose: "1 scoop", time: null },
  ];
  it("shows supplements once their time comes, never the any-time ones", () => {
    expect(nextUp({ ...base, now: "07:30", dueSupplements: supps }).map((x) => x.kind === "supplement" && x.supplementId)).toEqual(["d3"]);
    expect(nextUp({ ...base, now: "06:30", dueSupplements: supps })).toEqual([]);
    const late = nextUp({ ...base, now: "11:00", dueSupplements: supps })[0];
    expect(late).toMatchObject({ kind: "supplement", supplementId: "d3", overdue: true });
    expect(nextUp({ ...base, now: "21:30", dueSupplements: supps }).map((x) => x.kind === "supplement" && x.supplementId)).toEqual(["d3", "mg"]);
  });
});

describe("missed on an earlier day", () => {
  it("lists everything not done, with no time windows", async () => {
    const { missedOn } = await import("@/modules/engagement/rings");
    const items = missedOn({
      dueDoses: [{ medicineId: "b", name: "Night", strength: null, time: "21:00" }, { medicineId: "a", name: "Thyronorm", strength: null, time: "07:00" }],
      dueSupplements: [{ supplementId: "s", name: "Omega 3", dose: null, time: null }],
      water: { ml: 1200, target: 2500, start: "08:00", end: "19:30" },
      mealsLogged: ["lunch"],
      checkinDone: false,
    });
    expect(items.map((i) => i.kind)).toEqual(["dose", "dose", "supplement", "water", "meal", "meal", "check"]);
    expect(items[0]).toMatchObject({ name: "Thyronorm", overdue: true });
    expect(items[3]).toMatchObject({ behind: 1300 });
    expect(items.filter((i) => i.kind === "meal").map((i) => (i as { meal: string }).meal)).toEqual(["breakfast", "dinner"]);
  });
});

describe("tab of a path (for sliding page transitions)", () => {
  it("maps pages to their bottom tab", async () => {
    const { tabIndexOf } = await import("@/components/page-transition");
    expect(tabIndexOf("/")).toBe(0);
    expect(tabIndexOf("/medicines/manage")).toBe(1);
    expect(tabIndexOf("/food/plan")).toBe(2);
    expect(tabIndexOf("/settings/sharing")).toBe(3);
    expect(tabIndexOf("/assistant")).toBe(-1);
  });
});
