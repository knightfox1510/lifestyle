/** "How often" for medicines and supplements (pure; unit-tested). */
import { dayOfWeek } from "@/lib/dates";

export type Repeat = { days_of_week?: number[] | null; repeat_every_days?: number | null; start?: string | null };
export type Frequency = "daily" | "days" | "weekly" | "every_n";

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const diffDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/**
 * Due on `date`? Every N days counts from the start date (so "every 7 days
 * from Sun 2 Nov" is every Sunday, "every 30 days" is monthly from then);
 * otherwise the chosen weekdays, or every day.
 */
export function isDueOn(r: Repeat, date: string): boolean {
  if (r.start && date < r.start) return false;
  if (r.repeat_every_days && r.repeat_every_days > 1) {
    if (!r.start) return true;
    return diffDays(r.start, date) % r.repeat_every_days === 0;
  }
  return !r.days_of_week || !r.days_of_week.length || r.days_of_week.includes(dayOfWeek(date));
}

/** Next date it's due on or after `from` (within a year), for "next on Sun 9 Nov". */
export function nextDueOn(r: Repeat, from: string): string | null {
  const start = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i <= 366; i++) {
    const d = new Date(start + i * 864e5).toISOString().slice(0, 10);
    if (isDueOn(r, d)) return d;
  }
  return null;
}

/** Which of the four choices a schedule is, for the form. */
export function frequencyOf(r: Repeat): Frequency {
  if (r.repeat_every_days && r.repeat_every_days > 1) return "every_n";
  if (r.days_of_week && r.days_of_week.length === 1) return "weekly";
  if (r.days_of_week && r.days_of_week.length > 1 && r.days_of_week.length < 7) return "days";
  return "daily";
}

/** "Every day", "Mon, Wed, Fri", "Weekly on Sunday", "Every 14 days". */
export function describeRepeat(r: Repeat): string {
  const f = frequencyOf(r);
  if (f === "every_n") return r.repeat_every_days === 7 ? "Every 7 days" : r.repeat_every_days === 30 ? "Every 30 days" : `Every ${r.repeat_every_days} days`;
  if (f === "weekly") return `Weekly on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][r.days_of_week![0]]}`;
  if (f === "days") return [...r.days_of_week!].sort().map((d) => DAY_SHORT[d]).join(", ");
  return "Every day";
}
