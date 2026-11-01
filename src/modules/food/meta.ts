import type { FoodEntry, Meal, NutritionGoals } from "@/lib/types";

export const MEAL_META: Record<Meal, { label: string; icon: string }> = {
  breakfast: { label: "Breakfast", icon: "🍳" },
  lunch: { label: "Lunch", icon: "🍛" },
  dinner: { label: "Dinner", icon: "🍲" },
  snack: { label: "Snacks", icon: "🍎" },
  other: { label: "Other / misc", icon: "🥤" },
};
export const MEAL_ORDER: Meal[] = ["breakfast", "lunch", "snack", "dinner", "other"];

export const DIET_LABEL: Record<NutritionGoals["diet_type"], string> = {
  any: "No restriction",
  vegetarian: "Vegetarian",
  eggetarian: "Eggetarian",
  vegan: "Vegan",
  jain: "Jain",
  pescatarian: "Pescatarian",
  non_vegetarian: "Non-vegetarian",
};

export const GOAL_LABEL: Record<NutritionGoals["goal"], string> = {
  lose: "Lose fat",
  maintain: "Maintain",
  gain: "Gain weight / muscle",
  recomp: "Body recomposition",
};

export const ACTIVITY_LABEL: Record<NutritionGoals["activity_level"], string> = {
  sedentary: "Sedentary (desk, little exercise)",
  light: "Light (1–3 workouts/week)",
  moderate: "Moderate (3–5 workouts/week)",
  active: "Active (6–7 workouts/week)",
  very_active: "Very active (physical job + training)",
};

export const COOKING_LABEL: Record<NutritionGoals["cooking_style"], string> = {
  quick: "Quick (≤ 20 min)",
  balanced: "Balanced (≤ 40 min)",
  elaborate: "Happy to cook",
  meal_prep: "Batch / meal prep",
};

/** Guess the meal slot from the local hour. */
export function mealForHour(hour: number): Meal {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

export type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };

export function totals(entries: Pick<FoodEntry, "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g">[]): Totals {
  const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  for (const e of entries) {
    t.calories += Number(e.calories ?? 0);
    t.protein_g += Number(e.protein_g ?? 0);
    t.carbs_g += Number(e.carbs_g ?? 0);
    t.fat_g += Number(e.fat_g ?? 0);
    t.fiber_g += Number(e.fiber_g ?? 0);
  }
  return {
    calories: Math.round(t.calories),
    protein_g: Math.round(t.protein_g),
    carbs_g: Math.round(t.carbs_g),
    fat_g: Math.round(t.fat_g),
    fiber_g: Math.round(t.fiber_g),
  };
}

/** Mifflin–St Jeor maintenance estimate (used as a sanity hint next to AI targets). */
export function maintenanceCalories(input: { weightKg: number; heightCm: number; age: number; sex: "female" | "male" | "other" | null; activity: NutritionGoals["activity_level"] }) {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + (input.sex === "male" ? 5 : input.sex === "female" ? -161 : -78);
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[input.activity];
  return Math.round((base * factor) / 10) * 10;
}

/** Typical local time for each meal, used when logging for an earlier day. */
export const MEAL_DEFAULT_TIME: Record<Meal, string> = { breakfast: "08:30", lunch: "13:30", snack: "17:00", dinner: "20:30", other: "11:00" };

/**
 * ISO timestamp for `meal` on `date` (YYYY-MM-DD) at its usual local time in
 * `tz`. Never later than `now`, so a meal logged today can't be in the future.
 */
export function mealTimeOn(date: string, meal: Meal, tz: string, now: Date = new Date()): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = MEAL_DEFAULT_TIME[meal].split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // The zone's offset at that moment: format the instant in tz and read it back as if UTC.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  const instant = guess - (asUtc - guess);
  return new Date(Math.min(instant, now.getTime())).toISOString();
}

/** Where a new entry goes: "now" for today, otherwise the meal's usual time on that day. */
export type LogDay = { date: string; today: string; tz: string };
export function eatenAtFor(day: LogDay | undefined, meal: Meal): string | undefined {
  return !day || day.date === day.today ? undefined : mealTimeOn(day.date, meal, day.tz);
}
