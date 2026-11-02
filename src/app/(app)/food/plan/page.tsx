import Link from "next/link";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { addDays, shortDate, shortDay, todayIn } from "@/lib/dates";
import { Card, buttonClass, cx } from "@/components/ui";
import type { MealPlanEntry, PantryItem, Recipe } from "@/lib/types";
import { MEAL_META } from "@/modules/food/meta";
import { PLAN_MEALS, WEEKDAY_SHORT, mergeIngredients, planDayTotals, planWeek, type PlanMacros, type ShopIngredient } from "@/modules/food/plan";
import { inPantry } from "@/modules/pantry/match";
import { loadUsuals } from "@/lib/week-plan";
import { AiWeekPlanner, CopyWeekButton, GroceryListButton, PlannedDish, ShoppingDayPicker, SlotAdd, type PlanPerson } from "./plan-client";

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

  const memberIds = session.members.map((m) => m.user_id);
  const goalOwners = session.isModuleEnabled("food_diary") ? memberIds.filter((id) => session.accessTo("food_diary", id) !== "none") : [];
  const [{ data: plan }, { data: recipes }, pantryRes, { usuals, logged }, goalsRes] = await Promise.all([
    session.supabase.from("meal_plan").select("*").eq("household_id", session.household.id).gte("plan_date", days[0]).lte("plan_date", days[6]).order("created_at"),
    session.supabase.from("recipes").select("*").eq("household_id", session.household.id).order("title"),
    session.isModuleEnabled("pantry")
      ? session.supabase.from("pantry_items").select("name, used_up_at").eq("household_id", session.household.id).is("used_up_at", null)
      : Promise.resolve({ data: [] }),
    loadUsuals(session, today),
    goalOwners.length ? session.supabase.from("nutrition_goals").select("owner_id, calories, protein_g").in("owner_id", goalOwners) : Promise.resolve({ data: [] }),
  ]);
  const goals = new Map(((goalsRes.data ?? []) as { owner_id: string; calories: number | null; protein_g: number | null }[]).map((g) => [g.owner_id, g]));
  const people: PlanPerson[] = session.members.map((m) => ({ id: m.user_id, name: m.display_name, kcal: goals.get(m.user_id)?.calories ?? null, protein: goals.get(m.user_id)?.protein_g ?? null }));
  const canLogFor = memberIds.some((id) => session.isModuleEnabled("food_diary") && session.accessTo("food_diary", id) === "write");
  const entries = (plan ?? []) as MealPlanEntry[];
  const recipeList = (recipes ?? []) as Recipe[];
  const byId = new Map(recipeList.map((r) => [r.id, r]));
  const pantry = (pantryRes.data ?? []) as Pick<PantryItem, "name" | "used_up_at">[];
  const groceriesOn = session.isModuleEnabled("groceries");
  const servings = Math.max(1, session.members.length);

  // Everything still to cook this week (saved recipes' ingredients and the plan's own lists), merged, minus the pantry.
  const needed = mergeIngredients(
    entries
      .filter((x) => x.plan_date >= today && !x.logged_at)
      .map((e) => ((e.recipe_id ? byId.get(e.recipe_id)?.ingredients : e.ingredients) ?? []).map((i) => ({ name: i.name, quantity: i.quantity ?? null, category: i.category })) as ShopIngredient[]),
  ).filter((i) => !inPantry(i.name, pantry)) as { name: string; quantity: string | null; category: Recipe["ingredients"][number]["category"] }[];
  const recipeMacros = new Map<string, PlanMacros>(recipeList.map((r) => [r.id, { kcal_per_serving: r.calories_per_serving, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g }]));
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
          {groceriesOn ? <GroceryListButton items={needed} label={t("Add this week's {n} ingredients to the grocery list", { n: needed.length })} /> : null}
        </div>
      </Card>

      {days[6] >= today ? <AiWeekPlanner key={days[0]} weekStart={days[0]} groceriesOn={groceriesOn} learnedFrom={logged} people={people} /> : null}

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
              {list.length ? (
                <p className="-mt-1 mb-2 text-[11px] text-fg-muted">
                  {(() => {
                    const tot = planDayTotals(list, memberIds, recipeMacros);
                    return people
                      .map((p) => {
                        const x = tot[p.id];
                        if (!x?.dishes) return null;
                        const kcal = `${x.kcal.toLocaleString("en-IN")}${p.kcal ? `/${p.kcal.toLocaleString("en-IN")}` : ""} kcal`;
                        return `${p.name.split(" ")[0]} ${kcal} · P ${x.protein}${p.protein ? `/${p.protein}` : ""} g${x.unknown ? ` (+${x.unknown} unknown)` : ""}`;
                      })
                      .filter(Boolean)
                      .join("  ·  ");
                  })()}
                </p>
              ) : null}
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
                            const m = r ? recipeMacros.get(r.id)! : e;
                            return (
                              <PlannedDish
                                key={e.id}
                                entry={{ id: e.id, for_user: e.for_user ?? null, portions: e.portions ?? {}, recipe_id: e.recipe_id, logged: Boolean(e.logged_at), servings: e.servings }}
                                title={title}
                                recipeHref={r ? `/recipes/${r.id}` : null}
                                people={people}
                                canLog={canLogFor && d <= today}
                                weekStart={days[0]}
                                macros={{ kcal: m.kcal_per_serving ?? null, protein: m.protein_g != null ? Number(m.protein_g) : null }}
                              />
                            );
                          })}
                          {!past ? (
                            <SlotAdd
                              date={d}
                              meal={m}
                              servings={servings}
                              usuals={usuals[m].map((u) => u.title).filter((u) => !here.some((e) => (e.title ?? "").toLowerCase() === u.toLowerCase())).slice(0, 6)}
                              recipes={recipeList.map((r) => ({ id: r.id, title: r.title }))}
                              people={people}
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
