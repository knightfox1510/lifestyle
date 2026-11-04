/** Pure rules for the daily goals ("rings"), day closing, next-up and milestones. */

export type RingKey = "water" | "food" | "meds" | "check";
export type RingInput = { key: RingKey; value: number; target: number };
export type Ring = RingInput & { pct: number };

export const MAIN_MEALS = ["breakfast", "lunch", "dinner"] as const;

export function rings(inputs: RingInput[]): Ring[] {
  return inputs.filter((r) => r.target > 0).map((r) => ({ ...r, pct: Math.min(1, Math.max(0, r.value / r.target)) }));
}

/** Water counts as one item per this many ml (2 L → 4 glasses-worth of items). */
export const WATER_ML_PER_ITEM = 500;

/** How many "things" a ring stands for: each dose, each main meal, the check-in, and water in 500 ml steps. */
function ringItems(r: Ring) {
  return r.key === "water" ? r.target / WATER_ML_PER_ITEM : r.target;
}

/**
 * Share of today's things done, 0–100. Every dose, meal and the check-in
 * counts as one thing, and water counts per 500 ml, so finishing one small
 * ring early (say, a single morning tablet) no longer jumps the day to 25–33%.
 */
export function dayScore(rs: Ring[]) {
  const total = rs.reduce((a, r) => a + ringItems(r), 0);
  if (!total) return 0;
  const done = rs.reduce((a, r) => a + ringItems(r) * r.pct, 0);
  return Math.round((done / total) * 100);
}

/** A day is closed when every goal shown that day is complete. */
export function dayClosed(rs: Ring[]) {
  return rs.length > 0 && rs.every((r) => r.pct >= 1);
}

export function ringsLeft(rs: Ring[]) {
  return rs.filter((r) => r.pct < 1);
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/** Expected water by `now`, paced evenly between start and end. */
export function waterPace(now: string, start: string, end: string, target: number) {
  const n = toMin(now), s = toMin(start), e = toMin(end);
  if (n <= s) return 0;
  if (n >= e) return target;
  return Math.round((target * (n - s)) / (e - s));
}

export type NextUpInput = {
  now: string;
  dueDoses: { medicineId: string; name: string; strength: string | null; time: string; pillShape?: string | null; pillColor?: string | null }[];
  /** Supplements not ticked yet today; `time` null = any time (e.g. post-workout), never pushed. */
  dueSupplements?: { supplementId: string; name: string; dose: string | null; time: string | null; pillShape?: string | null; pillColor?: string | null }[];
  water: { ml: number; target: number; start: string; end: string } | null;
  mealsLogged: string[] | null;
  checkinDone: boolean | null;
};
export type NextUpItem =
  | { kind: "dose"; medicineId: string; name: string; strength: string | null; time: string; overdue: boolean; pillShape?: string | null; pillColor?: string | null }
  | { kind: "supplement"; supplementId: string; name: string; dose: string | null; time: string; overdue: boolean; pillShape?: string | null; pillColor?: string | null }
  | { kind: "water"; ml: number; target: number; behind: number }
  | { kind: "meal"; meal: (typeof MAIN_MEALS)[number] }
  | { kind: "check" };

const MEAL_WINDOWS: Record<(typeof MAIN_MEALS)[number], [string, string]> = { breakfast: ["06:30", "11:00"], lunch: ["12:00", "15:30"], dinner: ["19:00", "22:30"] };

/** Everything left undone on an earlier day: every dose and supplement not ticked, water short of the target, meals not logged, no check-in. */
export function missedOn(i: Omit<NextUpInput, "now">): NextUpItem[] {
  const out: NextUpItem[] = [
    ...[...i.dueDoses].sort((a, b) => a.time.localeCompare(b.time)).map((d) => ({ kind: "dose" as const, ...d, overdue: true })),
    ...(i.dueSupplements ?? []).map((x) => ({ kind: "supplement" as const, ...x, time: x.time ?? "", overdue: true })),
  ];
  if (i.water && i.water.ml < i.water.target) out.push({ kind: "water", ml: i.water.ml, target: i.water.target, behind: i.water.target - i.water.ml });
  if (i.mealsLogged) for (const meal of MAIN_MEALS) if (!i.mealsLogged.includes(meal)) out.push({ kind: "meal", meal });
  if (i.checkinDone === false) out.push({ kind: "check" });
  return out;
}

/** The few things worth doing now: overdue/soon doses and supplements first, then water if behind, the current meal, the evening check-in. */
export function nextUp(i: NextUpInput, limit = 5): NextUpItem[] {
  const n = toMin(i.now);
  const out: NextUpItem[] = [];
  const doses = i.dueDoses
    .filter((d) => toMin(d.time) <= n + 120)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((d) => ({ kind: "dose" as const, ...d, overdue: toMin(d.time) < n }));
  out.push(...doses);
  // Supplements once their time of day has come (or is within the hour); they're gentler than doses, so "overdue" waits 2 hours.
  const supps = (i.dueSupplements ?? [])
    .filter((x): x is { supplementId: string; name: string; dose: string | null; time: string; pillShape?: string | null; pillColor?: string | null } => x.time !== null && toMin(x.time) <= n + 60)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((x) => ({ kind: "supplement" as const, ...x, overdue: toMin(x.time) + 120 < n }));
  out.push(...supps);
  if (i.water && i.water.ml < i.water.target) {
    const behind = waterPace(i.now, i.water.start, i.water.end, i.water.target) - i.water.ml;
    if (behind >= 200) out.push({ kind: "water", ml: i.water.ml, target: i.water.target, behind });
  }
  if (i.mealsLogged) {
    for (const meal of MAIN_MEALS) {
      const [s, e] = MEAL_WINDOWS[meal];
      if (n >= toMin(s) && n <= toMin(e) + 60 && !i.mealsLogged.includes(meal)) out.push({ kind: "meal", meal });
    }
  }
  if (i.checkinDone === false && n >= 18 * 60) out.push({ kind: "check" });
  return out.slice(0, limit);
}

export type MilestoneStats = {
  streak: number;
  closedDays: number;
  dosesTaken: number;
  mealsLogged: number;
  waterTargetDays7: number;
  bladderLoggedDays7: number | null;
  leaks7: number | null;
};

export const MILESTONES: { key: string; title: string; detail: string; test: (s: MilestoneStats) => boolean }[] = [
  { key: "first_close", title: "First day closed", detail: "Every goal done in one day. Do it again tomorrow.", test: (s) => s.closedDays >= 1 },
  { key: "streak_7", title: "7-day streak", detail: "A full week of logging.", test: (s) => s.streak >= 7 },
  { key: "streak_30", title: "30-day streak", detail: "A month of showing up for yourself.", test: (s) => s.streak >= 30 },
  { key: "streak_100", title: "100-day streak", detail: "One hundred days. This is a habit now.", test: (s) => s.streak >= 100 },
  { key: "doses_30", title: "30 doses on record", detail: "Your medicine history is building up for your doctor.", test: (s) => s.dosesTaken >= 30 },
  { key: "meals_50", title: "50 meals logged", detail: "Enough data for really useful food insights.", test: (s) => s.mealsLogged >= 50 },
  { key: "water_week", title: "Water goal, 7 days running", detail: "Hit your water target every day this week.", test: (s) => s.waterTargetDays7 >= 7 },
  { key: "leak_free_week", title: "First leak-free week", detail: "No leaks logged in 7 days. Your pelvic floor work is paying off.", test: (s) => s.bladderLoggedDays7 != null && s.bladderLoggedDays7 >= 5 && s.leaks7 === 0 },
];

export function newMilestones(stats: MilestoneStats, achieved: Set<string>) {
  return MILESTONES.filter((m) => !achieved.has(m.key) && m.test(stats));
}
