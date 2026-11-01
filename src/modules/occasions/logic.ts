import { daysUntil } from "@/modules/pantry/match";
import type { Occasion } from "@/lib/types";

/** Next date (YYYY-MM-DD) this occasion happens on or after `today`. Feb 29 falls back to Feb 28 in non-leap years. */
export function nextOccurrence(o: Pick<Occasion, "month" | "day" | "year" | "recurring">, today: string): string | null {
  const ty = Number(today.slice(0, 4));
  const make = (y: number) => {
    const last = new Date(Date.UTC(y, o.month, 0)).getUTCDate();
    return `${y}-${String(o.month).padStart(2, "0")}-${String(Math.min(o.day, last)).padStart(2, "0")}`;
  };
  if (!o.recurring) {
    if (!o.year) return null;
    const d = make(o.year);
    return d >= today ? d : null;
  }
  const thisYear = make(ty);
  return thisYear >= today ? thisYear : make(ty + 1);
}

export function occasionInfo(o: Occasion, today: string) {
  const next = nextOccurrence(o, today);
  const inDays = next ? daysUntil(next, today) : null;
  const years = next && o.year ? Number(next.slice(0, 4)) - o.year : null;
  const label =
    years && years > 0
      ? o.kind === "birthday"
        ? `turns ${years}`
        : o.kind === "anniversary"
          ? `${ordinal(years)} anniversary`
          : null
      : null;
  return { next, inDays, label };
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
