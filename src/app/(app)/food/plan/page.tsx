import Link from "next/link";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { addDays, shortDate, shortDay, todayIn } from "@/lib/dates";
import { Card, buttonClass, cx } from "@/components/ui";
import type { MealPlanEntry, PantryItem, Recipe } from "@/lib/types";
import { MEAL_META } from "@/modules/food/meta";
import { PLAN_MEALS, WEEKDAY_SHORT, planWeek } from "@/modules/food/plan";
import { inPantry } from "@/modules/pantry/match";
import { loadUsuals } from "@/lib/week-plan";
import { AiWeekPlanner, CopyWeekButton, GroceryListButton, RemovePlanned, ShoppingDayPicker, SlotAdd } from "./plan-client";

export const metadata = { title: "Week plan" };

export default async function WeekPlanPage({ searchParams }: PageProps<"/food/plan">) {
  const session = await getSession();
  const t = await getT(session);
  const today = todayIn(session.profile.timezone);
  const shoppingDay = session.household.shopping_day ?? 0;
  const { week } = await searchParams;
  const base = typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  const days = planWeek(base, shoppingDay);
  const thisWeek = days.includes(today);

  const [{ data: plan }, { data: recipes }, pantryRes, { usuals, logged }] = await Promise.all([
    session.supabase.from("meal_plan").select("*").eq("household_id", session.household.id).gte("plan_date", days[0]).lte("plan_date", days[6]).order("created_at"),
    session.supabase.from("recipes").select("*").eq("household_id", session.household.id).order("title"),
    session.isModuleEnabled("pantry")
      ? session.supabase.from("pantry_items").select("name, used_up_at").eq("household_id", session.household.id).is("used_up_at", null)
      : Promise.resolve({ data: [] }),
    loadUsuals(session, today),
  ]);
  const entries = (plan ?? []) as MealPlanEntry[];
  const recipeList = (recipes ?? []) as Recipe[];
  const byId = new Map(recipeList.map((r) => [r.id, r]));
  const pantry = (pantryRes.data ?? []) as Pick<PantryItem, "name" | "used_up_at">[];
  const groceriesOn = session.isModuleEnabled("groceries");
  const servings = Math.max(1, session.members.length);

  // Saved-recipe ingredients still needed this week, minus what's in the pantry.
  const needed = new Map<string, { name: string; quantity: string | null; category: Recipe["ingredients"][number]["category"] }>();
  for (const e of entries.filter((x) => x.plan_date >= today && x.recipe_id)) {
    for (const ing of byId.get(e.recipe_id!)?.ingredients ?? []) {
      if (inPantry(ing.name, pantry)) continue;
      const key = ing.name.toLowerCase();
      if (!needed.has(key)) needed.set(key, { name: ing.name, quantity: ing.quantity ?? null, category: ing.category });
    }
  }
  const filled = PLAN_MEALS.filter((m) => m !== "snack").length * 7;
  const plannedSlots = new Set(entries.filter((e) => e.meal !== "snack").map((e) => `${e.plan_date}|${e.meal}`)).size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/food/plan?week=${addDays(days[0], -7)}`} className={buttonClass("ghost", "sm")}>← {t("Previous")}</Link>
        <div className="text-center">
          <p className="font-semibold">{thisWeek ? t("This week") : `${shortDate(days[0])} – ${shortDate(days[6])}`}</p>
          <p className="text-xs text-fg-muted">{t("{n} of {total} meals planned", { n: plannedSlots, total: filled })}</p>
        </div>
        <Link href={`/food/plan?week=${addDays(days[0], 7)}`} className={buttonClass("ghost", "sm")}>{t("Next")} →</Link>
      </div>

      <Card className="space-y-3">
        <ShoppingDayPicker day={shoppingDay} />
        <p className="text-xs text-fg-muted">
          {t("Weeks run {from} to {to}, so one shop covers the whole plan.", { from: t(WEEKDAY_SHORT[shoppingDay]), to: t(WEEKDAY_SHORT[(shoppingDay + 6) % 7]) })}
          {thisWeek && days[0] !== today ? ` ${t("Next shop: {date}.", { date: `${t(shortDay(addDays(days[0], 7)))} ${shortDate(addDays(days[0], 7))}` })}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyWeekButton weekStart={days[0]} />
          {groceriesOn ? <GroceryListButton items={[...needed.values()]} label={t("Add {n} recipe ingredients to the grocery list", { n: needed.size })} /> : null}
        </div>
      </Card>

      {days[6] >= today ? <AiWeekPlanner key={days[0]} weekStart={days[0]} groceriesOn={groceriesOn} learnedFrom={logged} /> : null}

      <div className="grid gap-3 md:grid-cols-2">
        {days.map((d) => {
          const list = entries.filter((e) => e.plan_date === d);
          const past = d < today;
          return (
            <Card key={d} className={cx("!p-4", d === today && "ring-2 ring-accent/40", past && "opacity-70")}>
              <p className="mb-2 font-semibold">
                {d === today ? t("Today") : t(shortDay(d))} <span className="text-sm font-normal text-fg-muted">{shortDate(d)}</span>
                {d === days[0] ? <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">🛒 {t("Shopping day")}</span> : null}
              </p>
              <ul className="space-y-2">
                {PLAN_MEALS.map((m) => {
                  const here = list.filter((e) => e.meal === m);
                  return (
                    <li key={m} className="text-sm">
                      <div className="flex items-start gap-2">
                        <span className="w-20 shrink-0 text-xs text-fg-muted">{MEAL_META[m].icon} {t(MEAL_META[m].label)}</span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          {here.map((e) => {
                            const r = e.recipe_id ? byId.get(e.recipe_id) : undefined;
                            const title = r?.title ?? e.title ?? "";
                            return (
                              <div key={e.id} className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate">
                                  {r ? <Link href={`/recipes/${r.id}`} className="hover:underline">{title}</Link> : title}
                                </span>
                                <RemovePlanned id={e.id} label={title} />
                              </div>
                            );
                          })}
                          {!past ? (
                            <SlotAdd
                              date={d}
                              meal={m}
                              servings={servings}
                              usuals={usuals[m].map((u) => u.title).filter((u) => !here.some((e) => (e.title ?? "").toLowerCase() === u.toLowerCase())).slice(0, 6)}
                              recipes={recipeList.map((r) => ({ id: r.id, title: r.title }))}
                            />
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      {logged ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">{t("What you usually have")}</h2>
          <p className="mb-3 text-xs text-fg-muted">{t("Learned from your food diary and past plans; recent weeks count more, so it keeps up as your habits change.")}</p>
          <div className="space-y-2">
            {PLAN_MEALS.filter((m) => usuals[m].length).map((m) => (
              <p key={m} className="text-sm">
                <span className="text-fg-muted">{MEAL_META[m].icon} {t(MEAL_META[m].label)}:</span> {usuals[m].slice(0, 6).map((u) => `${u.title} (${u.count}×)`).join(", ")}
              </p>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
