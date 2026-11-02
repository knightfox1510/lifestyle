import { localDate, localHour } from "@/lib/dates";
import type { BladderEvent, DailyCheckin, FluidIntake, PelvicFloorSession } from "@/lib/types";
import { PHYSICAL_TRIGGERS, TRIGGER_LABEL } from "./meta";

export type DayStats = {
  date: string;
  leaks: number;
  urges: number;
  voids: number;
  padChanges: number;
  fluidMl: number;
  caffeineMl: number;
  alcoholMl: number;
  kegel: boolean;
  /** Workout kinds done that day (gym, yoga…) from the fitness log. */
  workouts: string[];
  /** Bladder irritants eaten or drunk that day (spicy, citrus, caffeine…). */
  irritants: string[];
};

export function dailyStats(
  days: string[],
  events: BladderEvent[],
  fluids: FluidIntake[],
  tz: string,
  sessions: PelvicFloorSession[] = [],
  workouts: { performed_on: string; kind: string; status: string }[] = [],
  foods: { eaten_at: string; irritants?: string[] | null }[] = [],
): DayStats[] {
  const map = new Map<string, DayStats>(
    days.map((date) => [date, { date, leaks: 0, urges: 0, voids: 0, padChanges: 0, fluidMl: 0, caffeineMl: 0, alcoholMl: 0, kegel: false, workouts: [] as string[], irritants: [] as string[] }]),
  );
  for (const e of events) {
    const d = map.get(localDate(e.occurred_at, tz));
    if (!d) continue;
    if (e.kind === "leak") d.leaks += 1;
    if (e.kind === "urge") d.urges += 1;
    if (e.kind === "void") d.voids += 1;
    if (e.pad_changed) d.padChanges += 1;
  }
  const addIrritant = (d: DayStats, x: string) => {
    if (!d.irritants.includes(x)) d.irritants.push(x);
  };
  for (const f of fluids) {
    const d = map.get(localDate(f.occurred_at, tz));
    if (!d) continue;
    d.fluidMl += f.volume_ml;
    if (f.caffeinated) {
      d.caffeineMl += f.volume_ml;
      addIrritant(d, "caffeine");
    }
    if (f.drink === "alcohol") {
      d.alcoholMl += f.volume_ml;
      addIrritant(d, "alcohol");
    }
    if (f.drink === "soda") addIrritant(d, "carbonated");
  }
  for (const food of foods) {
    const d = map.get(localDate(food.eaten_at, tz));
    if (d) for (const x of food.irritants ?? []) addIrritant(d, x);
  }
  for (const s of sessions) {
    const d = map.get(localDate(s.performed_at, tz));
    if (d && s.completed) d.kegel = true;
  }
  for (const w of workouts) {
    const d = map.get(w.performed_on);
    if (d && w.status === "done" && !d.workouts.includes(w.kind)) d.workouts.push(w.kind);
  }
  return days.map((d) => map.get(d)!);
}

export function triggerCounts(events: BladderEvent[]) {
  const counts = new Map<string, number>();
  for (const e of events.filter((x) => x.kind === "leak")) {
    for (const t of e.triggers) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, label: TRIGGER_LABEL[key as keyof typeof TRIGGER_LABEL] ?? key, value }));
}

export function hourHistogram(events: BladderEvent[], tz: string, kind: BladderEvent["kind"] = "leak") {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const e of events) if (e.kind === kind) hours[localHour(e.occurred_at, tz)] += 1;
  return hours;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export type Comparison = { label: string; a: { label: string; value: number | null; days: number }; b: { label: string; value: number | null; days: number }; note?: string };

/**
 * Simple, honest comparisons (averages per day, with day counts so small
 * samples are visible). Not statistics: meant to guide a conversation with a
 * doctor or physio.
 */
export function comparisons(stats: DayStats[], checkins: DailyCheckin[]): Comparison[] {
  const logged = stats.filter((s) => s.leaks + s.urges + s.voids + s.fluidMl > 0);
  const out: Comparison[] = [];
  const split = (label: string, pred: (s: DayStats) => boolean, aLabel: string, bLabel: string, note?: string) => {
    const a = logged.filter(pred);
    const b = logged.filter((s) => !pred(s));
    out.push({
      label,
      a: { label: aLabel, value: round1(avg(a.map((s) => s.leaks))), days: a.length },
      b: { label: bLabel, value: round1(avg(b.map((s) => s.leaks))), days: b.length },
      note,
    });
  };
  if (stats.some((s) => s.workouts.length)) {
    split("Workouts", (s) => s.workouts.length > 0, "workout days", "rest days");
    if (stats.some((s) => s.workouts.includes("gym"))) split("Gym", (s) => s.workouts.includes("gym"), "gym days", "other days");
    if (stats.some((s) => s.workouts.includes("yoga"))) split("Yoga", (s) => s.workouts.includes("yoga"), "yoga days", "other days");
  }
  split("Caffeine", (s) => s.caffeineMl >= 250, "≥250 ml caffeinated", "less caffeine");
  if (stats.some((s) => s.irritants.length)) {
    split("Bladder irritants", (s) => s.irritants.length >= 2, "2+ irritants (food & drink)", "0–1 irritants");
    for (const [key, label] of [["spicy", "Spicy food"], ["citrus", "Citrus"], ["tomato", "Tomato"], ["carbonated", "Fizzy drinks"], ["sweetener", "Artificial sweeteners"]] as const) {
      const n = stats.filter((s) => s.irritants.includes(key)).length;
      if (n >= 2) split(label, (s) => s.irritants.includes(key), `${label.toLowerCase()} days`, "other days");
    }
  }
  split("Pelvic floor exercises", (s) => s.kegel, "Kegel days", "no session");
  split("Fluid intake", (s) => s.fluidMl >= 2000, "≥2 L fluids", "under 2 L", "Too little fluid can also irritate the bladder; don't cut water without advice.");
  split("Alcohol", (s) => s.alcoholMl > 0, "with alcohol", "no alcohol");

  const sleepByDate = new Map(checkins.map((c) => [c.checkin_date, c]));
  const withSleep = logged.filter((s) => sleepByDate.get(s.date)?.sleep_quality);
  if (withSleep.length) {
    const poor = withSleep.filter((s) => (sleepByDate.get(s.date)!.sleep_quality ?? 5) <= 2);
    const ok = withSleep.filter((s) => (sleepByDate.get(s.date)!.sleep_quality ?? 0) > 2);
    out.push({
      label: "Sleep",
      a: { label: "poor sleep (1–2)", value: round1(avg(poor.map((s) => s.leaks))), days: poor.length },
      b: { label: "okay or better", value: round1(avg(ok.map((s) => s.leaks))), days: ok.length },
    });
  }
  return out;
}

/** Share of leaks that happened within `hours` after a caffeinated drink. */
export function leaksAfterCaffeine(events: BladderEvent[], fluids: FluidIntake[], hours = 2) {
  const leaks = events.filter((e) => e.kind === "leak");
  const caffeine = fluids.filter((f) => f.caffeinated).map((f) => new Date(f.occurred_at).getTime());
  const windowMs = hours * 3600_000;
  const after = leaks.filter((l) => {
    const t = new Date(l.occurred_at).getTime();
    return caffeine.some((c) => t >= c && t - c <= windowMs);
  });
  return { total: leaks.length, after: after.length };
}

export function physicalShare(events: BladderEvent[]) {
  const leaks = events.filter((e) => e.kind === "leak");
  const physical = leaks.filter((e) => e.triggers.some((t) => PHYSICAL_TRIGGERS.has(t)));
  const urge = leaks.filter((e) => e.triggers.includes("urgency") || (e.urgency ?? 0) >= 4);
  return { total: leaks.length, physical: physical.length, urge: urge.length };
}

/** Compare the first and second half of the period: is it improving? */
export function trend(stats: DayStats[]) {
  const logged = stats.filter((s) => s.leaks + s.urges + s.voids + s.fluidMl > 0);
  if (logged.length < 6) return null;
  const mid = Math.floor(logged.length / 2);
  const first = avg(logged.slice(0, mid).map((s) => s.leaks))!;
  const second = avg(logged.slice(mid).map((s) => s.leaks))!;
  const change = first === 0 ? (second === 0 ? 0 : 100) : Math.round(((second - first) / first) * 100);
  return { first: round1(first)!, second: round1(second)!, change };
}

const isLogged = (s: DayStats) => s.leaks + s.urges + s.voids + s.fluidMl > 0;

/** 7-day average of leaks per day over logged days only (a day with no diary isn't a dry day). */
export function loggedRollingAverage(stats: DayStats[], window = 7): (number | null)[] {
  return stats.map((_, i) => {
    const slice = stats.slice(Math.max(0, i - window + 1), i + 1).filter(isLogged);
    return slice.length >= 3 ? round1(avg(slice.map((s) => s.leaks))) : null;
  });
}

export type WeekStats = { start: string; days: number; leaks: number; perDay: number | null; urgesPerDay: number | null; voidsPerDay: number | null; change: number | null };

/** Monday-to-Sunday weeks: leaks per logged day, and the change from the week before. */
export function weeklyStats(stats: DayStats[]): WeekStats[] {
  const weeks = new Map<string, DayStats[]>();
  for (const s of stats) {
    const dow = new Date(`${s.date}T12:00:00Z`).getUTCDay();
    const start = new Date(Date.parse(`${s.date}T12:00:00Z`) - ((dow + 6) % 7) * 864e5).toISOString().slice(0, 10);
    weeks.set(start, [...(weeks.get(start) ?? []), s]);
  }
  const out: WeekStats[] = [];
  for (const [start, list] of [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const logged = list.filter(isLogged);
    const perDay = round1(avg(logged.map((s) => s.leaks)));
    const prev = out.at(-1)?.perDay ?? null;
    out.push({
      start,
      days: logged.length,
      leaks: logged.reduce((a, s) => a + s.leaks, 0),
      perDay,
      urgesPerDay: round1(avg(logged.map((s) => s.urges))),
      voidsPerDay: round1(avg(logged.map((s) => s.voids))),
      change: perDay !== null && prev !== null && prev > 0 ? Math.round(((perDay - prev) / prev) * 100) : null,
    });
  }
  return out;
}

/**
 * Straight-line trend through the weekly averages (weeks with 3+ logged days):
 * leaks/day change per week, and as a % of the average. Null with < 3 weeks.
 */
export function weeklyTrend(weeks: WeekStats[]) {
  const pts = weeks.filter((w) => w.perDay !== null && w.days >= 3).map((w, i) => ({ x: i, y: w.perDay! }));
  if (pts.length < 3) return null;
  const mx = avg(pts.map((p) => p.x))!;
  const my = avg(pts.map((p) => p.y))!;
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return { weeks: pts.length, perWeek: Math.round(slope * 10) / 10, pctPerWeek: my > 0 ? Math.round((slope / my) * 100) : 0 };
}

/** Average leaks per logged day for each weekday (Mon first). */
export function weekdayPattern(stats: DayStats[]) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.map((name, i) => {
    const days = stats.filter((s) => isLogged(s) && (new Date(`${s.date}T12:00:00Z`).getUTCDay() + 6) % 7 === i);
    return { name, days: days.length, perDay: round1(avg(days.map((s) => s.leaks))) };
  });
}
