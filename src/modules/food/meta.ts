import type { FoodEntry, Meal, NutritionGoals } from "@/lib/types";

export const MEAL_META: Record<Meal, { label: string; icon: string }> = {
  breakfast: { label: "Breakfast", icon: "🍳" },
  lunch: { label: "Lunch", icon: "🍛" },
  dinner: { label: "Dinner", icon: "🍲" },
  snack: { label: "Snacks", icon: "🍎" },
};
export const MEAL_ORDER: Meal[] = ["breakfast", "lunch", "snack", "dinner"];

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
