/** Pure timing rules for reminders (unit-tested). */

/** Cron runs every ~5 minutes; a reminder fires if its time fell in this window. */
export const WINDOW_MINUTES = 15;

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** True when `now` (HH:MM) is within [target, target + window). Handles midnight wrap. */
export function inWindow(now: string, target: number, window = WINDOW_MINUTES) {
  const diff = (toMinutes(now) - ((target % 1440) + 1440) % 1440 + 1440) % 1440;
  return diff < window;
}

export function inQuietHours(now: string, start: string | null, end: string | null) {
  if (!start || !end) return false;
  const n = toMinutes(now);
  const s = toMinutes(start.slice(0, 5));
  const e = toMinutes(end.slice(0, 5));
  return s <= e ? n >= s && n < e : n >= s || n < e;
}

/** Days-before thresholds at which a document/maintenance reminder is sent. */
export function shouldRemind(daysLeft: number, remindBefore: number) {
  if (daysLeft < 0) return daysLeft === -1; // once, the day after it lapsed
  return [remindBefore, 30, 14, 7, 1, 0].includes(daysLeft) && daysLeft <= remindBefore;
}

