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

/** ISO timestamp for a local wall-clock date + "HH:MM" in a timezone (handles DST/offsets). */
export function zonedIso(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (asUtc - guess)).toISOString();
}

/** "YYYY-MM-DDTHH:MM" (a datetime-local input, in `tz`) → ISO timestamp; null if malformed or in the future. */
export function localInputToIso(value: unknown, tz: string): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const iso = zonedIso(value.slice(0, 10), value.slice(11, 16), tz);
  return Date.parse(iso) > Date.now() + 5 * 60_000 ? null : iso;
}

/** ISO timestamp → "YYYY-MM-DDTHH:MM" in `tz`, for a datetime-local input. */
export function isoToLocalInput(iso: string, tz: string): string {
  return `${localDate(iso, tz)}T${localTime(iso, tz)}`;
}
