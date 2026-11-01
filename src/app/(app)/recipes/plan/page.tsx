import Link from "next/link";
import { getSession } from "@/lib/session";
import { addDays, dayOfWeek, shortDate, shortDay, todayIn } from "@/lib/dates";
import { Card, buttonClass, cx } from "@/components/ui";
import type { MealPlanEntry, PantryItem, Recipe } from "@/lib/types";
import { MEAL_META, MEAL_ORDER } from "@/modules/food/meta";
import { inPantry } from "@/modules/pantry/match";
import { PlanForm, WeekGroceryButton } from "./plan-client";
import { removeFromPlan } from "../actions";

export const metadata = { title: "Meal plan" };

export default async function MealPlanPage({ searchParams }: PageProps<"/recipes/plan">) {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const { week } = await searchParams;
  const base = typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  const monday = addDays(base, -((dayOfWeek(base) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const [{ data: plan }, { data: recipes }, pantryRes] = await Promise.all([
    session.supabase.from("meal_plan").select("*").eq("household_id", session.household.id).gte("plan_date", days[0]).lte("plan_date", days[6]).order("created_at"),
    session.supabase.from("recipes").select("*").eq("household_id", session.household.id).order("title"),
    session.isModuleEnabled("pantry")
      ? session.supabase.from("pantry_items").select("name, used_up_at").eq("household_id", session.household.id).is("used_up_at", null)
      : Promise.resolve({ data: [] }),
  ]);
  const entries = (plan ?? []) as MealPlanEntry[];
  const recipeList = (recipes ?? []) as Recipe[];
  const byId = new Map(recipeList.map((r) => [r.id, r]));
  const pantry = (pantryRes.data ?? []) as Pick<PantryItem, "name" | "used_up_at">[];

  // Ingredients for the rest of this week, minus what's in the pantry.
  const needed = new Map<string, { name: string; quantity: string | null; category: Recipe["ingredients"][number]["category"] }>();
  for (const e of entries.filter((x) => x.plan_date >= today && x.recipe_id)) {
    for (const ing of byId.get(e.recipe_id!)?.ingredients ?? []) {
      if (inPantry(ing.name, pantry)) continue;
      const key = ing.name.toLowerCase();
      if (!needed.has(key)) needed.set(key, { name: ing.name, quantity: null, category: ing.category });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/recipes/plan?week=${addDays(monday, -7)}`} className={buttonClass("ghost", "sm")}>← Previous</Link>
        <p className="font-semibold">Week of {shortDate(monday)}</p>
        <Link href={`/recipes/plan?week=${addDays(monday, 7)}`} className={buttonClass("ghost", "sm")}>Next →</Link>
      </div>

      <PlanForm recipes={recipeList.map((r) => ({ id: r.id, title: r.title, servings: r.servings }))} days={days} today={today} />

      {session.isModuleEnabled("groceries") ? <WeekGroceryButton items={[...needed.values()]} /> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {days.map((d) => {
          const list = entries.filter((e) => e.plan_date === d);
          return (
            <Card key={d} className={cx("!p-4", d === today && "ring-2 ring-accent/40", d < today && "opacity-70")}>
              <p className="mb-2 font-medium">
                {d === today ? "Today" : shortDay(d)} <span className="text-sm font-normal text-fg-muted">{shortDate(d)}</span>
              </p>
              {list.length === 0 ? (
                <p className="text-sm text-fg-muted">Nothing planned</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {MEAL_ORDER.flatMap((m) =>
                    list
                      .filter((e) => e.meal === m)
                      .map((e) => {
                        const r = e.recipe_id ? byId.get(e.recipe_id) : undefined;
                        return (
                          <li key={e.id} className="flex items-start justify-between gap-2">
                            <span>
                              <span aria-hidden>{MEAL_META[m].icon}</span>{" "}
                              {r ? <Link href={`/recipes/${r.id}`} className="hover:underline">{r.title}</Link> : e.title}
                              <span className="text-xs text-fg-muted"> · {e.servings}×</span>
                            </span>
                            <form action={removeFromPlan.bind(null, e.id)}>
                              <button className="text-xs text-fg-muted hover:text-danger" aria-label="Remove from plan">✕</button>
                            </form>
                          </li>
                        );
                      }),
                  )}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
