/** Date helpers that respect the person's timezone. Dates are "YYYY-MM-DD" strings. */

export function todayIn(tz: string): string {
  return localDate(new Date(), tz);
}

export function localDate(at: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    typeof at === "string" ? new Date(at) : at,
  );
}

export function localTime(at: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    typeof at === "string" ? new Date(at) : at,
  );
}

export function localHour(at: Date | string, tz: string): number {
  return Number(localTime(at, tz).slice(0, 2));
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Oldest → newest, inclusive of `end`. */
export function lastNDays(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

/** UTC instant for the start of a local day (good enough as a query bound; ±1 day of slack is added by callers). */
export function startOfLocalDayIso(date: string): string {
  return new Date(`${addDays(date, -1)}T00:00:00Z`).toISOString();
}

export function shortDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
}

export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}
