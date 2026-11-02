/** Cycle tracking: periods from logged days, cycle lengths, predictions and phases (pure; unit-tested). */
import { addDays } from "@/lib/dates";

export const FLOWS = ["spotting", "light", "medium", "heavy"] as const;
export type Flow = (typeof FLOWS)[number];
export const SYMPTOMS = ["cramps", "bloating", "headache", "back_pain", "breast_tenderness", "fatigue", "mood", "acne", "nausea", "cravings", "discharge", "pelvic_pain"] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export const FLOW_LABEL: Record<Flow, string> = { spotting: "Spotting", light: "Light", medium: "Medium", heavy: "Heavy" };
export const SYMPTOM_LABEL: Record<Symptom, string> = {
  cramps: "Cramps",
  bloating: "Bloating",
  headache: "Headache",
  back_pain: "Back pain",
  breast_tenderness: "Breast tenderness",
  fatigue: "Tired",
  mood: "Low / irritable mood",
  acne: "Acne",
  nausea: "Nausea",
  cravings: "Cravings",
  discharge: "Discharge",
  pelvic_pain: "Pelvic pain",
};

export type CycleDay = { day: string; flow: Flow | null; symptoms: string[] };
export type Period = { start: string; end: string; days: number };
export type Phase = "menstrual" | "follicular" | "ovulation" | "luteal";
export const PHASE_LABEL: Record<Phase, string> = { menstrual: "Period", follicular: "After period", ovulation: "Around ovulation", luteal: "Before period" };

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/**
 * Periods = runs of bleeding days (gaps of up to 2 days allowed). Spotting on
 * its own never starts a period, but counts inside one.
 */
export function periodsFrom(days: CycleDay[]): Period[] {
  const bleeding = days.filter((d) => d.flow).sort((a, b) => a.day.localeCompare(b.day));
  const out: Period[] = [];
  let cur: { start: string; end: string; real: boolean } | null = null;
  for (const d of bleeding) {
    const real = d.flow !== "spotting";
    if (cur && dayDiff(cur.end, d.day) <= 3) {
      cur.end = d.day;
      if (!cur.real && real) {
        cur.start = d.day;
        cur.real = true;
      }
      continue;
    }
    if (cur?.real) out.push({ start: cur.start, end: cur.end, days: dayDiff(cur.start, cur.end) + 1 });
    cur = { start: d.day, end: d.day, real };
  }
  if (cur?.real) out.push({ start: cur.start, end: cur.end, days: dayDiff(cur.start, cur.end) + 1 });
  return out;
}

/** Cycle lengths between consecutive period starts (ignores implausible gaps, e.g. a missed month of logging). */
export function cycleLengths(periods: Period[]) {
  const out: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    const len = dayDiff(periods[i - 1].start, periods[i].start);
    if (len >= 15 && len <= 60) out.push(len);
  }
  return out;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

/** Typical cycle and period length from the last 6 cycles; 28/5 until there's data. */
export function cycleStats(periods: Period[]) {
  const lengths = cycleLengths(periods).slice(-6);
  const cycle = median(lengths);
  const period = median(periods.slice(-6).map((p) => p.days));
  const spread = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;
  return { cycle: cycle ?? 28, period: period ?? 5, known: lengths.length > 0, cycles: lengths.length, regular: spread === null ? null : spread <= 7, spread };
}

export type CycleStatus = {
  /** Day of the current cycle (1 = first day of the last period). */
  cycleDay: number | null;
  inPeriod: boolean;
  nextStart: string | null;
  daysUntilNext: number | null;
  late: number;
  fertile: { start: string; end: string } | null;
  phase: Phase | null;
};

/** Where today sits: cycle day, next expected period, and the estimated fertile window. */
export function cycleStatus(periods: Period[], today: string): CycleStatus {
  const last = periods.filter((p) => p.start <= today).at(-1);
  if (!last) return { cycleDay: null, inPeriod: false, nextStart: null, daysUntilNext: null, late: 0, fertile: null, phase: null };
  const s = cycleStats(periods);
  const cycleDay = dayDiff(last.start, today) + 1;
  const inPeriod = today <= last.end || (dayDiff(last.end, today) <= 1 && cycleDay <= s.period);
  const nextStart = addDays(last.start, s.cycle);
  const until = dayDiff(today, nextStart);
  const ovulation = addDays(nextStart, -14);
  return {
    cycleDay,
    inPeriod,
    nextStart,
    daysUntilNext: until,
    late: until < 0 ? -until : 0,
    fertile: s.known ? { start: addDays(ovulation, -5), end: addDays(ovulation, 1) } : null,
    phase: phaseOn(periods, today),
  };
}

/** Phase of a date from the period that started before it (null without a period or when far past the expected length). */
export function phaseOn(periods: Period[], date: string): Phase | null {
  const idx = periods.findLastIndex((p) => p.start <= date);
  if (idx < 0) return null;
  const p = periods[idx];
  const s = cycleStats(periods);
  const next = periods[idx + 1]?.start;
  const length = next ? dayDiff(p.start, next) : s.cycle;
  const day = dayDiff(p.start, date) + 1;
  if (day > length + 7) return null;
  if (date <= p.end) return "menstrual";
  const ovulationDay = length - 14;
  if (day >= ovulationDay - 2 && day <= ovulationDay + 1) return "ovulation";
  return day < ovulationDay ? "follicular" : "luteal";
}

/**
 * Average leaks per logged diary day in each phase, for days that fall inside
 * a tracked cycle. `leakDays` maps local date → leaks; `loggedDays` are dates
 * with any diary entry (so empty days aren't mistaken for dry days).
 */
export function leaksByPhase(periods: Period[], leakDays: Map<string, number>, loggedDays: Iterable<string>) {
  const acc: Record<Phase, { leaks: number; days: number }> = { menstrual: { leaks: 0, days: 0 }, follicular: { leaks: 0, days: 0 }, ovulation: { leaks: 0, days: 0 }, luteal: { leaks: 0, days: 0 } };
  for (const d of loggedDays) {
    const ph = phaseOn(periods, d);
    if (!ph) continue;
    acc[ph].days += 1;
    acc[ph].leaks += leakDays.get(d) ?? 0;
  }
  return (Object.keys(acc) as Phase[]).map((p) => ({ phase: p, days: acc[p].days, avg: acc[p].days ? Math.round((acc[p].leaks / acc[p].days) * 10) / 10 : null }));
}
