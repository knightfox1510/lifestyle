/**
 * When someone usually logs each main meal (pure; unit-tested): the median
 * clock time over recent days, once there are enough days to trust it.
 * Used to nudge "Lunch not logged yet" at *their* usual time, not a fixed one.
 */
export type MealTimeSample = { day: string; meal: string; minutes: number };

export function usualMealTimes(samples: MealTimeSample[], minDays = 5): Partial<Record<"breakfast" | "lunch" | "dinner", number>> {
  const out: Partial<Record<"breakfast" | "lunch" | "dinner", number>> = {};
  for (const meal of ["breakfast", "lunch", "dinner"] as const) {
    // The first entry of that meal each day.
    const firstByDay = new Map<string, number>();
    for (const s of samples) if (s.meal === meal) firstByDay.set(s.day, Math.min(firstByDay.get(s.day) ?? Infinity, s.minutes));
    const times = [...firstByDay.values()].sort((a, b) => a - b);
    if (times.length < minDays) continue;
    const mid = Math.floor(times.length / 2);
    out[meal] = times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2);
  }
  return out;
}
