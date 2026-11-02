/** Pure helpers for the weekly meal plan: the plan week, and the household's usual meals. */
import { addDays, dayOfWeek } from "@/lib/dates";
import type { Meal } from "@/lib/types";

export const PLAN_MEALS: Meal[] = ["breakfast", "lunch", "snack", "dinner"];

/** The 7 days of the plan week that contains `date`, starting on the shopping day (0 = Sun … 6 = Sat). */
export function planWeek(date: string, shoppingDay: number): string[] {
  const back = (dayOfWeek(date) - shoppingDay + 7) % 7;
  const start = addDays(date, -back);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** "2 rotis with ghee" and "Roti with ghee" are the same dish for learning purposes. */
export function dishKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b\d+(\.\d+)?\s*(x|pcs?|pieces?|bowls?|katoris?|cups?|plates?|glasses?|servings?|g|gm|grams?|ml)?\b/g, " ")
    .replace(/\b(a|an|the|of|one|two|three|half|small|medium|large|big|cup|bowl|plate|glass|katori)\b/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join(" ")
    .trim();
}

export type UsualSource = { title: string; meal: Meal; date: string; weight?: number };
export type Usual = { title: string; meal: Meal; count: number; lastDate: string; score: number };

/**
 * What the household usually eats per meal, learned from food diary entries
 * and past plans. Recent meals weigh more (half-life of 4 weeks), so the list
 * follows changing habits as you keep logging.
 */
export function usualMeals(sources: UsualSource[], today: string, perMeal = 8): Record<Meal, Usual[]> {
  const byKey = new Map<string, Usual & { titles: Map<string, number> }>();
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  for (const s of sources) {
    const key = dishKey(s.title);
    if (!key || key.length < 2) continue;
    const ageDays = Math.max(0, (todayMs - Date.parse(`${s.date}T00:00:00Z`)) / 864e5);
    const w = (s.weight ?? 1) * Math.pow(0.5, ageDays / 28);
    const id = `${s.meal}|${key}`;
    const u = byKey.get(id) ?? { title: s.title, meal: s.meal, count: 0, lastDate: s.date, score: 0, titles: new Map() };
    u.count += 1;
    u.score += w;
    if (s.date > u.lastDate) u.lastDate = s.date;
    const clean = s.title.trim();
    u.titles.set(clean, (u.titles.get(clean) ?? 0) + 1);
    byKey.set(id, u);
  }
  const out = { breakfast: [], lunch: [], dinner: [], snack: [], other: [] } as Record<Meal, Usual[]>;
  for (const u of byKey.values()) {
    // Show the most common spelling, preferring the shorter one on a tie.
    const title = [...u.titles.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
    out[u.meal].push({ title, meal: u.meal, count: u.count, lastDate: u.lastDate, score: Math.round(u.score * 100) / 100 });
  }
  for (const m of Object.keys(out) as Meal[]) out[m] = out[m].sort((a, b) => b.score - a.score || b.count - a.count).slice(0, perMeal);
  return out;
}

/** Shopping-day label, e.g. for "Shopping on Sat". */
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ------------------------------------------------------- per-person plans --

export type PlanMacros = { kcal_per_serving?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null };
export type PlanLike = PlanMacros & { for_user?: string | null; portions?: Record<string, number> | null; recipe_id?: string | null };
export type ShopIngredient = { name: string; quantity: string | null; category: string };

/** Who a planned dish is for: one person, or everyone. */
export function planFor(e: Pick<PlanLike, "for_user">, memberIds: string[]) {
  return e.for_user ? memberIds.filter((m) => m === e.for_user) : memberIds;
}

/** A person's servings of a planned dish (1 unless set). */
export function portionFor(e: Pick<PlanLike, "portions">, userId: string) {
  const v = Number(e.portions?.[userId]);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/** Each person's planned calories and macros for a day, using recipe numbers where a dish is a saved recipe. */
export function planDayTotals(entries: PlanLike[], memberIds: string[], recipeMacros: Map<string, PlanMacros>) {
  const out: Record<string, { kcal: number; protein: number; carbs: number; fat: number; dishes: number; unknown: number }> = {};
  for (const id of memberIds) out[id] = { kcal: 0, protein: 0, carbs: 0, fat: 0, dishes: 0, unknown: 0 };
  for (const e of entries) {
    const m = (e.recipe_id && recipeMacros.get(e.recipe_id)) || e;
    for (const id of planFor(e, memberIds)) {
      const p = portionFor(e, id);
      const t = out[id];
      t.dishes += 1;
      if (m.kcal_per_serving == null) {
        t.unknown += 1;
        continue;
      }
      t.kcal += Number(m.kcal_per_serving) * p;
      t.protein += Number(m.protein_g ?? 0) * p;
      t.carbs += Number(m.carbs_g ?? 0) * p;
      t.fat += Number(m.fat_g ?? 0) * p;
    }
  }
  for (const t of Object.values(out)) {
    t.kcal = Math.round(t.kcal);
    t.protein = Math.round(t.protein);
    t.carbs = Math.round(t.carbs);
    t.fat = Math.round(t.fat);
  }
  return out;
}

/** One shopping list from many dishes: same item once, quantities listed together ("500 g + 250 g"). */
export function mergeIngredients(lists: ShopIngredient[][]): ShopIngredient[] {
  const map = new Map<string, ShopIngredient & { qs: string[] }>();
  for (const list of lists) {
    for (const i of list) {
      const key = dishKey(i.name);
      if (!key) continue;
      const cur = map.get(key);
      if (cur) {
        if (i.quantity) cur.qs.push(i.quantity);
      } else map.set(key, { ...i, qs: i.quantity ? [i.quantity] : [] });
    }
  }
  return [...map.values()].map(({ qs, ...i }) => ({ ...i, quantity: qs.length ? [...new Set(qs)].join(" + ").slice(0, 40) : null }));
}
