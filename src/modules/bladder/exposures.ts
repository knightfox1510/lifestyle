/**
 * What happens in the hours after a drink or an irritant food (pure; unit-tested).
 * For each kind of exposure: how often a leak or urge followed within the
 * window, compared with how often one happens in any window of the same length
 * during the day ("usual"). A clearly higher rate with enough examples is
 * flagged as a likely trigger. Meant to guide a talk with the doctor or
 * physio, not as proof.
 */
import { zonedIso } from "@/lib/dates";
import type { BladderEvent, FluidIntake } from "@/lib/types";

export type Exposure = { key: string; label: string; at: number };
export type ExposureResult = {
  key: string;
  label: string;
  count: number;
  /** Share (0–1) followed by a leak or urge within the window. */
  rate: number;
  /** Median minutes to the next bathroom visit, urge or leak (within 4 h). */
  medianMinutes: number | null;
  likely: boolean;
};

const DRINK_LABEL: Record<string, string> = { water: "Water", tea: "Tea / chai", coffee: "Coffee", milk: "Milk", juice: "Juice", soda: "Fizzy drink", alcohol: "Alcohol", electrolyte: "ORS / electrolyte", other: "Other drinks" };
const FOOD_LABEL: Record<string, string> = { spicy: "Spicy food", citrus: "Citrus", tomato: "Tomato", carbonated: "Fizzy (food log)", sweetener: "Artificial sweetener", chocolate: "Chocolate", caffeine: "Caffeine (food log)", alcohol: "Alcohol (food log)" };

export function exposuresFrom(fluids: FluidIntake[], foods: { eaten_at: string; irritants?: string[] | null }[]): Exposure[] {
  const out: Exposure[] = [];
  for (const f of fluids) {
    const at = Date.parse(f.occurred_at);
    out.push({ key: `drink:${f.drink}`, label: DRINK_LABEL[f.drink] ?? f.drink, at });
    if (f.caffeinated && f.drink !== "coffee" && f.drink !== "tea") out.push({ key: "drink:caffeinated", label: "Other caffeinated drinks", at });
  }
  for (const f of foods) {
    for (const i of f.irritants ?? []) if (FOOD_LABEL[i]) out.push({ key: `food:${i}`, label: FOOD_LABEL[i], at: Date.parse(f.eaten_at) });
  }
  return out;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

/** Share of daytime windows (07:00–21:00, every 30 min) on logged days that contain a leak or urge. */
export function baselineRate(outcomes: number[], loggedDays: string[], tz: string, windowMs: number) {
  let hits = 0;
  let total = 0;
  const sorted = [...outcomes].sort((a, b) => a - b);
  for (const day of loggedDays) {
    const start = Date.parse(zonedIso(day, "07:00", tz));
    for (let t = start; t <= start + 14 * 3600_000; t += 30 * 60_000) {
      total += 1;
      if (sorted.some((o) => o >= t && o <= t + windowMs)) hits += 1;
    }
  }
  return total ? hits / total : null;
}

export function afterExposures(
  events: BladderEvent[],
  fluids: FluidIntake[],
  foods: { eaten_at: string; irritants?: string[] | null }[],
  loggedDays: string[],
  tz: string,
  hours = 2,
) {
  const windowMs = hours * 3600_000;
  const outcomes = events.filter((e) => e.kind === "leak" || (e.kind === "urge" && (e.urgency ?? 3) >= 3)).map((e) => Date.parse(e.occurred_at));
  const anyEvent = events.map((e) => Date.parse(e.occurred_at)).sort((a, b) => a - b);
  const usual = baselineRate(outcomes, loggedDays, tz, windowMs);
  const groups = new Map<string, Exposure[]>();
  for (const x of exposuresFrom(fluids, foods)) groups.set(x.key, [...(groups.get(x.key) ?? []), x]);

  const results: ExposureResult[] = [...groups.values()]
    .filter((xs) => xs.length >= 3)
    .map((xs) => {
      const followed = xs.filter((x) => outcomes.some((o) => o > x.at && o - x.at <= windowMs)).length;
      const nexts = xs.map((x) => anyEvent.find((o) => o > x.at)).map((o, i) => (o != null && o - xs[i].at <= 4 * 3600_000 ? (o - xs[i].at) / 60_000 : null)).filter((m): m is number => m !== null);
      const rate = followed / xs.length;
      return {
        key: xs[0].key,
        label: xs[0].label,
        count: xs.length,
        rate,
        medianMinutes: median(nexts),
        likely: usual !== null && xs.length >= 5 && rate >= 0.4 && rate >= usual * 1.5,
      };
    })
    .sort((a, b) => Number(b.likely) - Number(a.likely) || b.rate - a.rate || b.count - a.count);
  return { usual, hours, results };
}
