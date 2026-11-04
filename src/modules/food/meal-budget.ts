/**
 * How a day's calorie goal splits across meals (pure; unit-tested).
 * Each meal has a usual share; once some meals are logged, what's left of the
 * goal is spread over the meals still to come, so "dinner: ~450 kcal fits"
 * follows what you actually ate earlier.
 */
import type { Meal } from "@/lib/types";

export const MEAL_SHARE: Record<Meal, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3, other: 0 };

export type MealBudget = { meal: Meal; budget: number; eaten: number; /** For meals not logged yet: what fits in what's left of the goal. */ fits: number | null };

export function mealBudgets(goal: number, eaten: Partial<Record<Meal, number>>): MealBudget[] {
  const meals = (Object.keys(MEAL_SHARE) as Meal[]).filter((m) => MEAL_SHARE[m] > 0);
  const total = Object.values(eaten).reduce((a, v) => a + Number(v ?? 0), 0);
  const left = Math.max(0, goal - total);
  const open = meals.filter((m) => !(eaten[m] ?? 0));
  const openShare = open.reduce((a, m) => a + MEAL_SHARE[m], 0);
  return meals.map((m) => ({
    meal: m,
    budget: Math.round((goal * MEAL_SHARE[m]) / 10) * 10,
    eaten: Math.round(eaten[m] ?? 0),
    fits: open.includes(m) && openShare > 0 ? Math.round((left * MEAL_SHARE[m]) / openShare / 10) * 10 : null,
  }));
}
