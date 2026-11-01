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


/** Reminder slots (minutes since midnight) from start to end, every `interval` minutes. */
export function waterSlots(start: string, end: string, interval: number): number[] {
  const s = toMinutes(start.slice(0, 5));
  const e = toMinutes(end.slice(0, 5));
  if (interval < 15 || e <= s) return [];
  const out: number[] = [];
  for (let t = s; t <= e; t += interval) out.push(t);
  return out;
}

/** How much should have been drunk by the end of this slot's interval (paced evenly over the day). */
export function waterExpectedBy(slot: number, start: string, end: string, interval: number, target: number) {
  const s = toMinutes(start.slice(0, 5));
  const span = toMinutes(end.slice(0, 5)) - s + interval;
  return Math.round(target * Math.min(1, (slot - s + interval) / span));
}

/**
 * Which water reminder (if any) to send now: a slot whose time just passed,
 * only if the person is behind pace and hasn't had a drink recently.
 */
export function dueWaterSlot(opts: {
  now: string;
  start: string;
  end: string;
  interval: number;
  target: number;
  drunkMl: number;
  minutesSinceLastDrink: number | null;
}): { slot: number; expected: number } | null {
  if (opts.drunkMl >= opts.target) return null;
  if (opts.minutesSinceLastDrink != null && opts.minutesSinceLastDrink < 45) return null;
  const slot = waterSlots(opts.start, opts.end, opts.interval).find((t) => inWindow(opts.now, t));
  if (slot == null) return null;
  const expected = waterExpectedBy(slot, opts.start, opts.end, opts.interval, opts.target);
  return opts.drunkMl < expected ? { slot, expected } : null;
}
