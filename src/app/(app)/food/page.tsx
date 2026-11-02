import Link from "next/link";
import { WaterButtons } from "@/components/water-buttons";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { addDays, localDate, localTime, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card, buttonClass, cx, Notice } from "@/components/ui";
import type { FluidIntake, FoodEntry, Meal, NutritionGoals } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, eatenAtFor, totals } from "@/modules/food/meta";
import { DateJump } from "@/components/date-jump";
import { supplementNutrientsByDay } from "@/lib/supplement-nutrients";
import { MicroPanel } from "@/components/micro-panel";
import { AccuracyBadge } from "@/components/nutrition-ui";
import { dailyTargets, fromEntry, sum } from "@/modules/nutrition/nutrients";
import { labNutrientLinks } from "@/modules/nutrition/labs-link";
import { IRRITANT_META, type Irritant } from "@/modules/nutrition/irritants";
import type { LabResult } from "@/lib/types";
import { FoodAiAdd } from "./food-ai-add";
import { ManualFoodForm } from "./manual-food-form";
import { MealAdd } from "./meal-add";
import { FoodQuickSearch } from "./quick-search";
import { RestaurantPicker } from "./restaurant-picker";
import { repeatFood } from "./actions";
import { FoodEntryRow } from "./entry-row";

export const metadata = { title: "Food diary" };

export default async function FoodDiaryPage({ searchParams }: PageProps<"/food">) {
  const session = await getSession();
  const t = await getT(session);
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const { date: dParam, meal: mParam } = await searchParams;
  const date = typeof dParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dParam) && dParam <= today ? dParam : today;
  const presetMeal = MEAL_ORDER.find((m) => m === mParam);
  const day = { date, today, tz };
  const canWrite = session.accessTo("food_diary", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  // Your own drinks always show (water reminders); a partner's only with bladder-diary access.
  const fluidsVisible = ownerId === session.userId || (session.isModuleEnabled("bladder_diary") && session.accessTo("bladder_diary", ownerId) !== "none");

  const people = session.members.filter((m) => session.accessTo("food_diary", m.user_id) === "write").map((m) => ({ id: m.user_id, name: m.user_id === session.userId ? "Me" : m.display_name }));

  const diningOn = session.isModuleEnabled("dining");
  const [{ data: e }, { data: g }, { data: recent }, fl, rp, rd] = await Promise.all([
    session.supabase.from("food_entries").select("*").eq("owner_id", ownerId).gte("eaten_at", startOfLocalDayIso(addDays(date, -1))).lt("eaten_at", startOfLocalDayIso(addDays(date, 3))).order("eaten_at"),
    session.supabase.from("nutrition_goals").select("*").eq("owner_id", ownerId).maybeSingle(),
    session.supabase.from("food_entries").select("*").eq("owner_id", ownerId).order("eaten_at", { ascending: false }).limit(200),
    fluidsVisible
      ? session.supabase.from("fluid_intake").select("volume_ml, occurred_at").eq("owner_id", ownerId).gte("occurred_at", startOfLocalDayIso(date)).lt("occurred_at", startOfLocalDayIso(addDays(date, 3)))
      : Promise.resolve({ data: [] }),
    diningOn ? session.supabase.from("dining_places").select("id, name").eq("household_id", session.household.id).order("favorite", { ascending: false }).order("name") : Promise.resolve({ data: [] }),
    diningOn ? session.supabase.from("dining_dishes").select("id, name, place_id, calories, section").eq("household_id", session.household.id).order("name") : Promise.resolve({ data: [] }),
  ]);
  const medicalOn = session.isModuleEnabled("medical_records") && session.accessTo("medical_records", ownerId) !== "none";
  const [{ data: mp }, { data: labRows }] = await Promise.all([
    medicalOn ? session.supabase.from("medical_profiles").select("sex").eq("owner_id", ownerId).maybeSingle() : Promise.resolve({ data: null }),
    medicalOn ? session.supabase.from("lab_results").select("marker, value, unit, flag, test_date").eq("owner_id", ownerId).neq("flag", "normal").order("test_date", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
  ]);
  const restaurantPlaces = (rp.data ?? []) as { id: string; name: string }[];
  const restaurantDishes = (rd.data ?? []) as { id: string; name: string; place_id: string; calories: number | null; section: string | null }[];
  const entries = ((e ?? []) as FoodEntry[]).filter((x) => localDate(x.eaten_at, tz) === date);
  const goals = g as NutritionGoals | null;
  const supp = (await supplementNutrientsByDay(session, ownerId, date, date))[date] ?? {};
  const foodTot = totals(entries);
  // Protein/calories from supplements (e.g. whey) count towards the day too.
  const tot = { ...foodTot, calories: foodTot.calories + Math.round(supp.calories ?? 0), protein_g: Math.round((foodTot.protein_g + (supp.protein_g ?? 0)) * 10) / 10 };
  const dayNutrients = sum(entries.map((x) => fromEntry({ ...x, micros: x.micros ?? {} })));
  const targets = dailyTargets((mp as { sex: "female" | "male" | "other" | null } | null)?.sex ?? null, goals?.calories ?? null);
  const labLinks = labNutrientLinks((labRows ?? []) as Pick<LabResult, "marker" | "value" | "unit" | "flag" | "test_date">[]);
  const withData = entries.filter((x) => x.accuracy && x.accuracy !== "estimated").length;
  const water = ((fl.data ?? []) as Pick<FluidIntake, "volume_ml" | "occurred_at">[])
    .filter((x) => localDate(x.occurred_at, tz) === date)
    .reduce((a, x) => a + x.volume_ml, 0);

  const prevDate = addDays(date, -1);
  const prevEntries = ((e ?? []) as FoodEntry[]).filter((x) => localDate(x.eaten_at, tz) === prevDate);
  const previousFor = (meal: Meal) => {
    const items = prevEntries.filter((x) => x.meal === meal).map((x) => x.description);
    return items.length ? { date: prevDate, label: prevDate === addDays(today, -1) ? t("yesterday") : shortDate(prevDate), items } : null;
  };
  // Recently logged foods (one per name and meal), for search and one-tap re-adding.
  const recentSeen = new Set<string>();
  const recentFoods = ((recent ?? []) as FoodEntry[])
    .filter((x) => {
      const k = `${x.description.toLowerCase()}|${x.meal}`;
      if (recentSeen.has(k)) return false;
      recentSeen.add(k);
      return true;
    })
    .slice(0, 60)
    .map((x) => ({ id: x.id, description: x.description, quantity: x.quantity, calories: x.calories, meal: x.meal }));

  const seen = new Set<string>();
  const favourites = ((recent ?? []) as FoodEntry[]).filter((x) => {
    const k = x.description.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 8);

  const bars: { label: string; value: number; goal: number | null; unit: string }[] = [
    { label: "Calories", value: tot.calories, goal: goals?.calories ?? null, unit: "kcal" },
    { label: "Protein", value: tot.protein_g, goal: goals?.protein_g ?? null, unit: "g" },
    { label: "Carbs", value: tot.carbs_g, goal: goals?.carbs_g ?? null, unit: "g" },
    { label: "Fat", value: tot.fat_g, goal: goals?.fat_g ?? null, unit: "g" },
    { label: "Fibre", value: tot.fiber_g, goal: goals?.fiber_g ?? null, unit: "g" },
    ...(fluidsVisible ? [{ label: "Water & drinks", value: water, goal: goals?.water_ml ?? null, unit: "ml" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/food?date=${addDays(date, -1)}`} className={buttonClass("ghost", "sm")}>← {shortDate(addDays(date, -1))}</Link>
        <DateJump date={date} today={today} basePath="/food" label={date === today ? t("Today") : shortDate(date)} />
        {date < today ? (
          <Link href={date === addDays(today, -1) ? "/food" : `/food?date=${addDays(date, 1)}`} className={buttonClass("ghost", "sm")}>{shortDate(addDays(date, 1))} →</Link>
        ) : (
          <span className="w-20" />
        )}
      </div>

      <Card className="space-y-3">
        {bars.map((b) => {
          const pct = b.goal ? Math.min(100, (b.value / b.goal) * 100) : 0;
          const over = b.goal !== null && b.value > b.goal * 1.05;
          return (
            <div key={b.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{t(b.label)}</span>
                <span className="tabular-nums text-fg-muted">
                  <span className={cx("text-fg", over && b.label === "Calories" && "text-danger")}>{b.value.toLocaleString("en-IN")}</span>
                  {b.goal ? ` / ${b.goal.toLocaleString("en-IN")}` : ""} {b.unit}
                  {b.goal && b.label === "Calories" ? ` · ${b.goal - b.value >= 0 ? t("{n} left", { n: (b.goal - b.value).toLocaleString("en-IN") }) : t("{n} over", { n: (b.value - b.goal).toLocaleString("en-IN") })}` : ""}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className={cx("h-full rounded-full", over && b.label === "Calories" ? "bg-danger" : "bg-series-1")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {isOwner && date === today ? <WaterButtons /> : null}
        {!goals?.calories ? (
          <p className="text-xs text-fg-muted">
            <Link href="/food/goals" className="text-accent underline">{t("Set your goals")}</Link> {t("(AI can suggest them from your weight, activity and health).")}
          </p>
        ) : null}
      </Card>

      {entries.length || Object.keys(supp).length ? (
        <Card>
          <details open={labLinks.size > 0}>
            <summary className="cursor-pointer text-sm font-semibold">{t("Vitamins & minerals")} {labLinks.size ? <span className="text-xs font-normal text-danger">· {t("linked to your blood work")}</span> : null}</summary>
            <div className="mt-3">
              <MicroPanel totals={dayNutrients} targets={targets} labLinks={labLinks} coverage={{ withData, total: entries.length }} supplements={supp} />
            </div>
          </details>
        </Card>
      ) : null}

      {canWrite ? (
        <div id="add" className="scroll-mt-20 space-y-3">
          {date !== today ? (
            <Notice tone="accent">{t("Adding to {date}. Entries are saved at the meal's usual time.", { date: shortDate(date) })}</Notice>
          ) : null}
          <FoodQuickSearch ownerId={ownerId} people={people} day={day} meal={presetMeal} recent={recentFoods} />
          <FoodAiAdd
            key={`${date}-${presetMeal ?? ""}`}
            ownerId={ownerId}
            day={day}
            meal={presetMeal}
            people={people}
          />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <ManualFoodForm key={`m-${date}-${presetMeal ?? ""}`} ownerId={ownerId} day={day} meal={presetMeal} />
            <Link href="/food/product" className="text-sm text-fg-muted hover:text-fg">▥ {t("Scan a packaged food")}</Link>
            <Link href="/food/dishes" className="text-sm text-fg-muted hover:text-fg">🍛 {t("Indian dishes")}</Link>
            {restaurantPlaces.length ? <RestaurantPicker ownerId={ownerId} places={restaurantPlaces} dishes={restaurantDishes} day={day} /> : null}
          </div>
        </div>
      ) : null}

      {MEAL_ORDER.map((meal) => {
        const list = entries.filter((x) => x.meal === meal);
        const mt = totals(list);
        return (
          <Card key={meal} className="!p-4">
            {(() => {
              const heading = (
                <>
                  <h2 className="font-semibold">{MEAL_META[meal].icon} {t(MEAL_META[meal].label)}</h2>
                  <span className="ml-auto mr-3 text-sm tabular-nums text-fg-muted">{mt.calories} kcal</span>
                </>
              );
              return canWrite ? (
                <MealAdd key={`${date}-${meal}`} ownerId={ownerId} people={people} day={day} meal={meal} recent={recentFoods} previous={list.length ? null : previousFor(meal)}>{heading}</MealAdd>
              ) : (
                <div className="mb-1 flex items-baseline justify-between">{heading}</div>
              );
            })()}
            {list.length ? (
              <ul className="divide-y divide-border">
                {list.map((x) => (
                  <FoodEntryRow
                    key={x.id}
                    entry={{ id: x.id, description: x.description, quantity: x.quantity, meal: x.meal, time: localTime(x.eaten_at, tz), calories: x.calories }}
                    ownerId={ownerId}
                    canEdit={canWrite}
                    canDelete={canWrite && (isOwner || x.created_by === session.userId)}
                    meta={[
                      localTime(x.eaten_at, tz),
                      `P ${Math.round(Number(x.protein_g ?? 0))} · C ${Math.round(Number(x.carbs_g ?? 0))} · F ${Math.round(Number(x.fat_g ?? 0))}`,
                      x.grams ? `${Math.round(Number(x.grams))} g` : null,
                      x.source === "restaurant" ? t("restaurant") : null,
                      (x.irritants ?? []).length ? (x.irritants ?? []).map((i) => IRRITANT_META[i as Irritant]?.icon ?? "").join("") : null,
                      x.group_id ? t("shared meal") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <AccuracyBadge accuracy={x.accuracy} />
                  </FoodEntryRow>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">{t("Nothing logged.")}</p>
            )}
          </Card>
        );
      })}

      {canWrite && favourites.length ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">{t("Have it again")}</h2>
          <div className="flex flex-wrap gap-1.5">
            {favourites.map((f) => (
              <form key={f.id} action={repeatFood.bind(null, f.id, ownerId, f.meal, eatenAtFor(day, f.meal))}>
                <button className="rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-2">
                  + {f.description} <span className="text-fg-muted">{f.calories ?? ""}</span>
                </button>
              </form>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
