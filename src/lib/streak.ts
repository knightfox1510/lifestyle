import { addDays } from "@/lib/dates";

/** Consecutive days with activity, ending today (or yesterday if today isn't done yet). */
export function streak(dates: Set<string>, today: string) {
  let n = 0;
  let d = dates.has(today) ? today : addDays(today, -1);
  while (dates.has(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

/** ISO week key (Monday-based) for a YYYY-MM-DD date. */
function weekKey(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/**
 * Like `streak`, but forgiving: one missed day per week (Mon–Sun) doesn't
 * break it. Today not logged yet never breaks it. Rest days aren't counted.
 */
export function streakWithRest(dates: Set<string>, today: string, maxDays = 400) {
  let n = 0;
  const rests = new Set<string>();
  let d = dates.has(today) ? today : addDays(today, -1);
  for (let i = 0; i < maxDays; i++) {
    if (dates.has(d)) n += 1;
    else {
      const wk = weekKey(d);
      if (rests.has(wk)) break;
      // A rest day only counts if there's activity before it to continue.
      if (!dates.has(addDays(d, -1))) break;
      rests.add(wk);
    }
    d = addDays(d, -1);
  }
  return n;
}
