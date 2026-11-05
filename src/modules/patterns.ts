/**
 * "What affects what" (pure; unit-tested). Days are split into two groups by
 * one thing (short vs good sleep, caffeine vs none, weekend vs weekday…) and
 * another thing is compared between them. A pattern is only reported when both
 * groups have enough days and the gap is large next to the day-to-day spread
 * (effect size), so a couple of odd days don't make a "finding". It's a
 * comparison, not proof of cause, and it says so.
 */

export type DayFacts = {
  day: string;
  sleepH?: number | null;
  steps?: number | null;
  kcal?: number | null;
  protein?: number | null;
  leaks?: number | null;
  caffeineMl?: number | null;
  fluidMl?: number | null;
  mood?: number | null;
  energy?: number | null;
  stress?: number | null;
  workout?: boolean;
  /** Private log (only loaded for your own data): standard drinks that day, intimacy that day. */
  drinks?: number;
  intimacy?: boolean;
  /** Next morning's weight minus this morning's (kg). */
  weightChange?: number | null;
};

type Num = keyof Omit<DayFacts, "day" | "workout" | "intimacy">;
type Rule = {
  id: string;
  area: "food" | "sleep" | "bladder" | "mood" | "activity";
  /** Which group a day falls in: "a", "b" or null (neither / unknown). */
  split: (d: DayFacts) => "a" | "b" | null;
  /** The outcome, on the same day or the next one. */
  outcome: Num;
  nextDay?: boolean;
  a: string;
  b: string;
  unit: string;
  what: string;
  digits?: number;
  /** Uses the private log: shown only to its owner, on the private log page. */
  private?: boolean;
};

const has = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const drinkSplit = (d: DayFacts): "a" | "b" | null => (d.drinks === undefined ? null : d.drinks >= 2 ? "a" : d.drinks === 0 ? "b" : null);

export const RULES: Rule[] = [
  { id: "sleep-kcal", area: "food", split: (d) => (has(d.sleepH) ? (d.sleepH < 6.5 ? "a" : d.sleepH >= 7 ? "b" : null) : null), outcome: "kcal", a: "after nights under 6½ h", b: "after 7 h or more", unit: " kcal", what: "you eat" },
  { id: "sleep-energy", area: "mood", split: (d) => (has(d.sleepH) ? (d.sleepH < 6.5 ? "a" : d.sleepH >= 7 ? "b" : null) : null), outcome: "energy", a: "after nights under 6½ h", b: "after 7 h or more", unit: "/5", what: "your energy is", digits: 1 },
  { id: "sleep-leaks", area: "bladder", split: (d) => (has(d.sleepH) ? (d.sleepH < 6.5 ? "a" : d.sleepH >= 7 ? "b" : null) : null), outcome: "leaks", a: "after nights under 6½ h", b: "after 7 h or more", unit: " leaks", what: "you have", digits: 1 },
  { id: "caffeine-leaks", area: "bladder", split: (d) => (has(d.caffeineMl) ? (d.caffeineMl >= 200 ? "a" : d.caffeineMl === 0 ? "b" : null) : null), outcome: "leaks", a: "on days with 200 ml+ of tea/coffee", b: "on days with none", unit: " leaks", what: "you have", digits: 1 },
  { id: "fluid-leaks", area: "bladder", split: (d) => (has(d.fluidMl) && d.fluidMl > 0 ? (d.fluidMl < 1500 ? "a" : d.fluidMl >= 2000 ? "b" : null) : null), outcome: "leaks", a: "on days under 1.5 L of fluids", b: "on days with 2 L or more", unit: " leaks", what: "you have", digits: 1 },
  { id: "weekend-kcal", area: "food", split: (d) => ([0, 6].includes(new Date(`${d.day}T12:00:00Z`).getUTCDay()) ? "a" : "b"), outcome: "kcal", a: "on weekends", b: "on weekdays", unit: " kcal", what: "you eat" },
  { id: "stress-kcal", area: "food", split: (d) => (has(d.stress) ? (d.stress >= 4 ? "a" : d.stress <= 2 ? "b" : null) : null), outcome: "kcal", a: "on stressful days (4–5)", b: "on calm days (1–2)", unit: " kcal", what: "you eat" },
  { id: "steps-sleep", area: "sleep", split: (d) => (has(d.steps) ? (d.steps >= 8000 ? "a" : d.steps < 5000 ? "b" : null) : null), outcome: "sleepH", nextDay: true, a: "after days with 8,000+ steps", b: "after days under 5,000", unit: " h", what: "you sleep", digits: 1 },
  { id: "workout-sleep", area: "sleep", split: (d) => (d.workout === undefined ? null : d.workout ? "a" : "b"), outcome: "sleepH", nextDay: true, a: "after a workout day", b: "after days without one", unit: " h", what: "you sleep", digits: 1 },
  { id: "workout-mood", area: "mood", split: (d) => (d.workout === undefined ? null : d.workout ? "a" : "b"), outcome: "mood", a: "on workout days", b: "on other days", unit: "/5", what: "your mood is", digits: 1 },
  { id: "drinks-sleep", area: "sleep", private: true, split: drinkSplit, outcome: "sleepH", nextDay: true, a: "after drinking (2+ drinks)", b: "after alcohol-free days", unit: " h", what: "you sleep", digits: 1 },
  { id: "drinks-energy", area: "mood", private: true, split: drinkSplit, outcome: "energy", nextDay: true, a: "the day after drinking (2+ drinks)", b: "after alcohol-free days", unit: "/5", what: "your energy is", digits: 1 },
  { id: "drinks-mood", area: "mood", private: true, split: drinkSplit, outcome: "mood", nextDay: true, a: "the day after drinking (2+ drinks)", b: "after alcohol-free days", unit: "/5", what: "your mood is", digits: 1 },
  { id: "drinks-kcal", area: "food", private: true, split: drinkSplit, outcome: "kcal", nextDay: true, a: "the day after drinking (2+ drinks)", b: "after alcohol-free days", unit: " kcal", what: "you eat" },
  { id: "drinks-leaks", area: "bladder", private: true, split: drinkSplit, outcome: "leaks", a: "on drinking days (2+ drinks)", b: "on alcohol-free days", unit: " leaks", what: "you have", digits: 1 },
  { id: "drinks-weight", area: "food", private: true, split: drinkSplit, outcome: "weightChange", a: "after drinking (2+ drinks)", b: "after alcohol-free days", unit: " kg", what: "the scale moves", digits: 1 },
  { id: "intimacy-mood", area: "mood", private: true, split: (d) => (d.intimacy === undefined ? null : d.intimacy ? "a" : "b"), outcome: "mood", a: "on days with intimacy", b: "on other days", unit: "/5", what: "your mood is", digits: 1 },
  { id: "intimacy-stress", area: "mood", private: true, split: (d) => (d.intimacy === undefined ? null : d.intimacy ? "a" : "b"), outcome: "stress", a: "on days with intimacy", b: "on other days", unit: "/5", what: "your stress is", digits: 1 },
  { id: "intimacy-sleep", area: "sleep", private: true, split: (d) => (d.intimacy === undefined ? null : d.intimacy ? "a" : "b"), outcome: "sleepH", nextDay: true, a: "after days with intimacy", b: "after other days", unit: " h", what: "you sleep", digits: 1 },
  { id: "sleep-steps", area: "activity", split: (d) => (has(d.sleepH) ? (d.sleepH < 6.5 ? "a" : d.sleepH >= 7 ? "b" : null) : null), outcome: "steps", a: "after nights under 6½ h", b: "after 7 h or more", unit: " steps", what: "you walk" },
];

export type Pattern = { id: string; area: Rule["area"]; text: string; a: { label: string; mean: number; n: number }; b: { label: string; mean: number; n: number }; diff: number; strength: "clear" | "possible" };

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
};
const round = (n: number, digits = 0) => Math.round(n * 10 ** digits) / 10 ** digits;
const fmt = (n: number, digits = 0) => round(n, digits).toLocaleString("en-IN");

/** `rules`: the shared comparisons (default), or only the private-log ones (for its owner's private page). */
export function findPatterns(days: DayFacts[], minDays = 5, rules: "shared" | "private" = "shared"): { found: Pattern[]; needMore: string[] } {
  const sorted = [...days].sort((x, y) => x.day.localeCompare(y.day));
  const byDay = new Map(sorted.map((d) => [d.day, d]));
  const next = (day: string) => byDay.get(new Date(Date.parse(`${day}T12:00:00Z`) + 864e5).toISOString().slice(0, 10));
  const found: Pattern[] = [];
  const needMore: string[] = [];
  for (const r of RULES.filter((x) => Boolean(x.private) === (rules === "private"))) {
    const groups = { a: [] as number[], b: [] as number[] };
    for (const d of sorted) {
      const g = r.split(d);
      if (!g) continue;
      const o = r.nextDay ? next(d.day)?.[r.outcome] : d[r.outcome];
      if (has(o as number | null | undefined)) groups[g].push(o as number);
    }
    if (groups.a.length < minDays || groups.b.length < minDays) {
      needMore.push(r.id);
      continue;
    }
    const ma = mean(groups.a);
    const mb = mean(groups.b);
    const pooled = Math.sqrt((sd(groups.a) ** 2 + sd(groups.b) ** 2) / 2) || 1e-9;
    const effect = Math.abs(ma - mb) / pooled;
    const rel = Math.abs(ma - mb) / Math.max(Math.abs(mb), 1e-9);
    // Big enough next to the usual day-to-day spread, and not a trivial amount.
    if (effect < 0.5 || rel < 0.1) continue;
    const digits = r.digits ?? 0;
    const more = ma > mb;
    const diff = round(Math.abs(ma - mb), digits);
    const verb = r.what === "you eat" ? (more ? "about " + fmt(diff, digits) + " kcal more" : "about " + fmt(diff, digits) + " kcal less") : r.what === "you have" ? `${fmt(diff, digits)} ${more ? "more" : "fewer"}${r.unit}` : r.what === "you sleep" ? `${fmt(diff, digits)} h ${more ? "longer" : "less"}` : r.what === "you walk" ? `${fmt(diff, digits)} ${more ? "more" : "fewer"} steps` : r.what === "the scale moves" ? `${fmt(diff, digits)} kg ${more ? "more (up)" : "less"} by the next morning` : `${more ? "higher" : "lower"} (${fmt(ma, digits)} vs ${fmt(mb, digits)}${r.unit})`;
    const text =
      r.what === "your energy is" || r.what === "your mood is" || r.what === "your stress is"
        ? `${cap(r.a)} ${r.what} ${verb}.`
        : `${cap(r.a)} ${r.what} ${verb} (${fmt(ma, digits)} vs ${fmt(mb, digits)}${r.unit} ${r.b}).`;
    found.push({ id: r.id, area: r.area, text, a: { label: r.a, mean: round(ma, digits), n: groups.a.length }, b: { label: r.b, mean: round(mb, digits), n: groups.b.length }, diff, strength: effect >= 0.8 && groups.a.length >= 8 && groups.b.length >= 8 ? "clear" : "possible" });
  }
  found.sort((x, y) => (x.strength === y.strength ? 0 : x.strength === "clear" ? -1 : 1));
  return { found, needMore };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
