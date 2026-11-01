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
