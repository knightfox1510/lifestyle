import type { SupplementTiming } from "@/lib/types";

export const TIMING_LABEL: Record<SupplementTiming, string> = {
  morning: "Morning",
  with_meal: "With a meal",
  afternoon: "Afternoon",
  post_workout: "Post-workout",
  evening: "Evening",
  bedtime: "Bedtime",
};

/** Rough clock time for each timing, used to place supplements in Today's schedule ("post-workout" has none: it's whenever you train). */
export const TIMING_TIME: Record<SupplementTiming, string | null> = {
  morning: "08:00",
  with_meal: "13:30",
  afternoon: "15:00",
  post_workout: null,
  evening: "19:00",
  bedtime: "22:00",
};

/** The person's own clock times (Settings → Supplement times) over the defaults. */
export function timingTimes(overrides?: Record<string, string> | null): Record<SupplementTiming, string | null> {
  const out = { ...TIMING_TIME };
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (k in out && typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) out[k as SupplementTiming] = v;
  }
  return out;
}

/** A supplement's schedule, starting on schedule_start (or the day it was added). */
export function supplementRepeat(x: { days_of_week?: number[] | null; repeat_every_days?: number | null; schedule_start?: string | null; created_at?: string }, tzDate?: (iso: string) => string) {
  return {
    days_of_week: x.days_of_week ?? null,
    repeat_every_days: x.repeat_every_days ?? null,
    start: x.schedule_start ?? (x.created_at ? (tzDate ? tzDate(x.created_at) : x.created_at.slice(0, 10)) : null),
  };
}
