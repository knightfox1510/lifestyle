import { localHour } from "@/lib/dates";
import type { BladderEvent, BodyMetric, DailyCheckin, WearableDay } from "@/lib/types";
import type { DayStats } from "@/modules/bladder/analysis";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const nums = <T,>(rows: T[], f: (r: T) => number | null | undefined) => rows.map(f).filter((v): v is number => typeof v === "number" && Number.isFinite(v));

/** Age in whole years on a date (YYYY-MM-DD). */
export function ageOn(dob: string | null, today: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Weight, BP and glucose over the period (metrics sorted oldest → newest). */
export function vitalsSummary(metrics: BodyMetric[], heightCm: number | null) {
  const w = metrics.filter((m) => m.weight_kg != null);
  const first = w[0]?.weight_kg ?? null;
  const last = w.at(-1)?.weight_kg ?? null;
  const bp = metrics.filter((m) => m.bp_systolic != null && m.bp_diastolic != null);
  const glucose = metrics.filter((m) => m.blood_glucose_mgdl != null);
  return {
    weight: last != null ? Number(last) : null,
    weightChange: first != null && last != null && w.length > 1 ? r1(Number(last) - Number(first)) : null,
    bmi: last != null && heightCm ? r1(Number(last) / (heightCm / 100) ** 2) : null,
    bpLatest: bp.length ? `${bp.at(-1)!.bp_systolic}/${bp.at(-1)!.bp_diastolic}` : null,
    bpAverage: bp.length > 1 ? `${Math.round(avg(nums(bp, (m) => m.bp_systolic))!)}/${Math.round(avg(nums(bp, (m) => m.bp_diastolic))!)}` : null,
    bpReadings: bp.length,
    glucoseLatest: glucose.length ? Number(glucose.at(-1)!.blood_glucose_mgdl) : null,
    restingHr: r1(avg(nums(metrics, (m) => m.resting_hr))),
  };
}

/** Per-day averages over days with anything logged, plus night-time voids (22:00–06:00). */
export function bladderSummary(stats: DayStats[], events: BladderEvent[], tz: string) {
  const logged = stats.filter((s) => s.leaks + s.urges + s.voids + s.fluidMl > 0);
  if (!logged.length) return null;
  const per = (k: "leaks" | "urges" | "voids" | "fluidMl" | "padChanges") => r1(logged.reduce((a, s) => a + s[k], 0) / logged.length);
  const night = events.filter((e) => e.kind === "void" && (localHour(e.occurred_at, tz) >= 22 || localHour(e.occurred_at, tz) < 6)).length;
  return {
    days: logged.length,
    leaks: per("leaks"),
    urges: per("urges"),
    voids: per("voids"),
    nightVoids: r1(night / logged.length),
    fluidMl: Math.round((per("fluidMl") ?? 0) / 10) * 10,
    pads: per("padChanges"),
  };
}

export function wellbeingSummary(checkins: DailyCheckin[], wearables: WearableDay[]) {
  const sleepFromBand = nums(wearables, (w) => (w.sleep_minutes != null ? w.sleep_minutes / 60 : null));
  return {
    checkins: checkins.length,
    sleepHours: r1(avg(sleepFromBand.length >= 3 ? sleepFromBand : nums(checkins, (c) => c.sleep_hours))),
    sleepSource: sleepFromBand.length >= 3 ? "band" : "check-ins",
    mood: r1(avg(nums(checkins, (c) => c.mood))),
    energy: r1(avg(nums(checkins, (c) => c.energy))),
    stress: r1(avg(nums(checkins, (c) => c.stress))),
    steps: Math.round(avg(nums(wearables, (w) => w.steps)) ?? 0) || null,
  };
}
