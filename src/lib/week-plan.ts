import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, localDate, startOfLocalDayIso } from "@/lib/dates";
import type { FoodEntry, Meal, MealPlanEntry } from "@/lib/types";
import { usualMeals, type UsualSource } from "@/modules/food/plan";

/** How far back the planner learns from. */
export const LEARN_DAYS = 56;

/**
 * The household's usual meals: food diary entries of everyone whose diary you
 * can see, plus past plans (at half weight), over the last 8 weeks.
 */
export async function loadUsuals(session: AppSession, today: string) {
  const tz = session.profile.timezone;
  const from = addDays(today, -LEARN_DAYS);
  const owners = session.isModuleEnabled("food_diary") ? session.members.filter((m) => session.accessTo("food_diary", m.user_id) !== "none").map((m) => m.user_id) : [];
  const [food, plans] = await Promise.all([
    owners.length
      ? session.supabase.from("food_entries").select("description, meal, eaten_at, recipe_id").in("owner_id", owners).gte("eaten_at", startOfLocalDayIso(from)).limit(3000)
      : Promise.resolve({ data: [] }),
    session.supabase.from("meal_plan").select("plan_date, meal, title, recipe_id").eq("household_id", session.household.id).gte("plan_date", from).lt("plan_date", today).limit(1000),
  ]);
  const { data: recipes } = await session.supabase.from("recipes").select("id, title").eq("household_id", session.household.id);
  const recipeTitle = new Map(((recipes ?? []) as { id: string; title: string }[]).map((r) => [r.id, r.title]));
  const sources: UsualSource[] = [
    ...((food.data ?? []) as Pick<FoodEntry, "description" | "meal" | "eaten_at" | "recipe_id">[]).map((f) => ({
      title: (f.recipe_id && recipeTitle.get(f.recipe_id)) || f.description,
      meal: f.meal as Meal,
      date: localDate(f.eaten_at, tz),
    })),
    ...((plans.data ?? []) as Pick<MealPlanEntry, "plan_date" | "meal" | "title" | "recipe_id">[])
      .map((p) => ({ title: (p.recipe_id && recipeTitle.get(p.recipe_id)) || p.title || "", meal: p.meal, date: p.plan_date, weight: 0.5 }))
      .filter((p) => p.title),
  ];
  return { usuals: usualMeals(sources, today), logged: (food.data ?? []).length };
}
