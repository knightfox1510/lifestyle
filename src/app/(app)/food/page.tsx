import Link from "next/link";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { WaterButtons } from "@/components/water-buttons";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { addDays, localDate, localTime, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card, buttonClass, Notice } from "@/components/ui";
import type { FluidIntake, FoodEntry, Meal, NutritionGoals } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, totals } from "@/modules/food/meta";
import { DateJump } from "@/components/date-jump";
import { supplementNutrientsByDay } from "@/lib/supplement-nutrients";
import { MicroPanel } from "@/components/micro-panel";
import { AccuracyBadge } from "@/components/nutrition-ui";
import { dailyTargets, fromEntry, sum } from "@/modules/nutrition/nutrients";
import { labNutrientLinks } from "@/modules/nutrition/labs-link";
import { IRRITANT_META, type Irritant } from "@/modules/nutrition/irritants";
import type { LabResult } from "@/lib/types";
import { MealAdd } from "./meal-add";
import { AgainChips } from "./quick-search";
import { FoodAddPanel } from "./food-add-panel";
import { SaveMealButton } from "./copy-picker";
import { KcalRing } from "@/components/kcal-ring";
import { mealBudgets } from "@/modules/food/meal-budget";
import { foodEmoji } from "@/modules/food/emoji";
import { RestaurantPicker } from "./restaurant-picker";
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

  const people = session.members.filter((m) => session.accessTo("food_diary", m.user_id) === "write").map((m) => ({ id: m.user_id, name: m.user_id === session.userId ? `${m.display_name} (me)` : m.display_name }));
  // Others in the household whose food diary you can see: their meals can be copied into this one.
  const others = session.members.filter((m) => m.user_id !== ownerId && session.isModuleEnabled("food_diary") && session.accessTo("food_diary", m.user_id) !== "none");

  const diningOn = session.isModuleEnabled("dining");
  const medicalOn = session.isModuleEnabled("medical_records") && session.accessTo("medical_records", ownerId) !== "none";
  // Everything that doesn't depend on another query runs at once.
  const [{ data: e }, { data: g }, { data: recent }, fl, rp, rd, { data: tplRows }, { data: otherRows }, { data: mp }, { data: labRows }, suppByDay] = await Promise.all([
    session.supabase.from("food_entries").select("*").eq("owner_id", ownerId).gte("eaten_at", startOfLocalDayIso(addDays(date, -1))).lt("eaten_at", startOfLocalDayIso(addDays(date, 3))).order("eaten_at"),
    session.supabase.from("nutrition_goals").select("*").eq("owner_id", ownerId).maybeSingle(),
    session.supabase.from("food_entries").select("*").eq("owner_id", ownerId).order("eaten_at", { ascending: false }).limit(200),
    fluidsVisible
      ? session.supabase.from("fluid_intake").select("volume_ml, occurred_at").eq("owner_id", ownerId).gte("occurred_at", startOfLocalDayIso(date)).lt("occurred_at", startOfLocalDayIso(addDays(date, 3)))
      : Promise.resolve({ data: [] }),
    diningOn ? session.supabase.from("dining_places").select("id, name").eq("household_id", session.household.id).order("favorite", { ascending: false }).order("name") : Promise.resolve({ data: [] }),
    diningOn ? session.supabase.from("dining_dishes").select("id, name, place_id, calories, section").eq("household_id", session.household.id).order("name") : Promise.resolve({ data: [] }),
    canWrite ? session.supabase.from("meal_templates").select("id, name, meal, items, last_used_at").eq("household_id", session.household.id).order("last_used_at", { ascending: false, nullsFirst: false }).limit(30) : Promise.resolve({ data: [] }),
    canWrite && others.length
      ? session.supabase.from("food_entries").select("id, owner_id, eaten_at, meal, description, quantity, calories").in("owner_id", others.map((m) => m.user_id)).gte("eaten_at", startOfLocalDayIso(date)).lt("eaten_at", startOfLocalDayIso(addDays(date, 2))).order("eaten_at")
      : Promise.resolve({ data: [] }),
    medicalOn ? session.supabase.from("medical_profiles").select("sex").eq("owner_id", ownerId).maybeSingle() : Promise.resolve({ data: null }),
    medicalOn ? session.supabase.from("lab_results").select("marker, value, unit, flag, test_date").eq("owner_id", ownerId).neq("flag", "normal").order("test_date", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    supplementNutrientsByDay(session, ownerId, date, date),
  ]);
  const templates = (tplRows ?? []) as { id: string; name: string; meal: Meal | null; items: { description: string; quantity: string | null; calories: number | null }[] }[];
  const otherEntries = ((otherRows ?? []) as Pick<FoodEntry, "id" | "owner_id" | "eaten_at" | "meal" | "description" | "quantity" | "calories">[]).filter((x) => localDate(x.eaten_at, tz) === date);
  const restaurantPlaces = (rp.data ?? []) as { id: string; name: string }[];
  const restaurantDishes = (rd.data ?? []) as { id: string; name: string; place_id: string; calories: number | null; section: string | null }[];
  const entries = ((e ?? []) as FoodEntry[]).filter((x) => localDate(x.eaten_at, tz) === date);
  // Meal photos: short-lived links, each photo shown once (on the first item logged from it).
  const photoPaths = [...new Set(entries.map((x) => x.photo_path).filter((p): p is string => Boolean(p)))];
  const signed = photoPaths.length ? ((await session.supabase.storage.from("food-photos").createSignedUrls(photoPaths, 3600)).data ?? []) : [];
  const photoUrl = new Map(signed.filter((x) => x.signedUrl && x.path).map((x) => [x.path!, x.signedUrl]));
  const photoShownOn = new Map<string, string>();
  for (const x of entries) if (x.photo_path && !photoShownOn.has(x.photo_path)) photoShownOn.set(x.photo_path, x.id);
  const goals = g as NutritionGoals | null;
  const supp = suppByDay[date] ?? {};
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
  const item = (x: Pick<FoodEntry, "id" | "description" | "quantity" | "calories">) => ({ id: x.id, description: x.description, quantity: x.quantity, calories: x.calories });
  /** What can be copied into a meal: each partner's same meal that day, then this meal the day before. */
  const copiesFor = (meal: Meal) => [
    ...others
      .map((m) => ({ m, items: otherEntries.filter((x) => x.owner_id === m.user_id && x.meal === meal).map(item) }))
      .filter((x) => x.items.length)
      .map(({ m, items }) => ({ key: `p-${m.user_id}`, kind: "entries" as const, label: t("Copy {name}'s {meal}", { name: m.display_name, meal: t(MEAL_META[meal].label).toLowerCase() }), who: m.display_name, fromId: m.user_id, items })),
    ...(() => {
      const items = prevEntries.filter((x) => x.meal === meal).map(item);
      return items.length ? [{ key: "prev", kind: "entries" as const, label: t("Same as {day}", { day: prevDate === addDays(today, -1) ? t("yesterday") : shortDate(prevDate) }), who: null, items }] : [];
    })(),
    // Saved meals: this meal's first, then the rest (a few).
    ...[...templates.filter((x) => x.meal === meal), ...templates.filter((x) => x.meal !== meal)].slice(0, 5).map((x) => ({
      key: `t-${x.id}`,
      kind: "template" as const,
      templateId: x.id,
      label: x.name,
      who: null,
      items: x.items.map((i, n) => ({ id: String(n), description: i.description, quantity: i.quantity ?? null, calories: i.calories ?? null })),
    })),
  ];
  const budgets = goals?.calories ? mealBudgets(goals.calories, Object.fromEntries(MEAL_ORDER.map((m) => [m, totals(entries.filter((x) => x.meal === m)).calories]))) : [];
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
    <PullToRefresh>
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

      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          <KcalRing value={tot.calories} goal={goals?.calories ?? null} size={104} stroke={10} label={t("{n} kcal eaten", { n: tot.calories })}>
            <span>
              <span className="block text-[22px] font-semibold leading-none tabular-nums">{tot.calories.toLocaleString("en-IN")}</span>
              <span className="text-[11px] text-fg-muted">kcal</span>
            </span>
          </KcalRing>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm">
              {goals?.calories ? (
                goals.calories - tot.calories >= 0 ? (
                  <><strong className="text-[17px] tabular-nums">{(goals.calories - tot.calories).toLocaleString("en-IN")}</strong> <span className="text-fg-muted">{t("kcal left of {goal}", { goal: goals.calories.toLocaleString("en-IN") })}</span></>
                ) : (
                  <><strong className="text-[17px] tabular-nums text-danger">{(tot.calories - goals.calories).toLocaleString("en-IN")}</strong> <span className="text-fg-muted">{t("kcal over {goal}", { goal: goals.calories.toLocaleString("en-IN") })}</span></>
                )
              ) : (
                <span className="text-fg-muted">{t("No calorie goal yet")}</span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {bars.filter((b) => b.label !== "Calories").map((b) => {
                const pct = b.goal ? Math.min(100, (b.value / b.goal) * 100) : 0;
                return (
                  <div key={b.label}>
                    <div className="flex justify-between gap-1 text-[12px]">
                      <span className="truncate text-fg-muted">{t(b.label)}</span>
                      <span className="shrink-0 tabular-nums"><span className="font-medium">{Math.round(b.value).toLocaleString("en-IN")}</span>{b.goal ? <span className="text-fg-muted">/{b.goal.toLocaleString("en-IN")}</span> : null} <span className="text-fg-muted">{b.unit}</span></span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-series-1 transition-[width] duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {isOwner && date === today ? <WaterButtons /> : null}
        {!goals?.calories ? (
          <p className="text-xs text-fg-muted">
            <Link href="/food/goals" className="text-accent underline">{t("Set your goals")}</Link> {t("(AI can suggest them from your weight, activity and health).")}
          </p>
        ) : null}
      </Card>


      {canWrite ? (
        <div id="add" className="scroll-mt-20 space-y-3">
          {date !== today ? (
            <Notice tone="accent">{t("Adding to {date}. Entries are saved at the meal's usual time.", { date: shortDate(date) })}</Notice>
          ) : null}
          <Card className="!p-4">
            <FoodAddPanel
              ownerId={ownerId}
              people={people}
              day={day}
              meal={presetMeal}
              recent={recentFoods}
              extra={
                <>
                  <Link href="/food/product" className="text-sm text-fg-muted hover:text-fg">▥ {t("Scan a packaged food")}</Link>
                  <Link href="/food/dishes" className="text-sm text-fg-muted hover:text-fg">🍛 {t("Indian dishes")}</Link>
                  {restaurantPlaces.length ? <RestaurantPicker ownerId={ownerId} places={restaurantPlaces} dishes={restaurantDishes} day={day} /> : null}
                </>
              }
            />
          </Card>
        </div>
      ) : null}

      {MEAL_ORDER.map((meal) => {
        const list = entries.filter((x) => x.meal === meal);
        const mt = totals(list);
        return (
          <Card key={meal} className="!p-4">
            {(() => {
              const b = budgets.find((x) => x.meal === meal);
              const heading = (
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {b ? <KcalRing value={mt.calories} goal={b.budget} label={t("{n} of about {budget} kcal", { n: mt.calories, budget: b.budget })} /> : null}
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-tight">{MEAL_META[meal].icon} {t(MEAL_META[meal].label)}</h2>
                    <p className="text-[12px] tabular-nums text-fg-muted">
                      {list.length ? `${mt.calories} kcal · ${Math.round(mt.protein_g)} g protein` : b?.fits != null && date === today ? t("About {n} kcal fits", { n: b.fits.toLocaleString("en-IN") }) : t("Nothing logged")}
                    </p>
                  </div>
                </div>
              );
              return canWrite ? (
                <MealAdd key={`${date}-${meal}`} ownerId={ownerId} people={people} day={day} meal={meal} recent={recentFoods} copies={copiesFor(meal)} emptyLabel={list.length ? undefined : t("Log {meal}", { meal: t(MEAL_META[meal].label).toLowerCase() })}>{heading}</MealAdd>
              ) : (
                <div className="mb-1 flex items-baseline justify-between">{heading}</div>
              );
            })()}
            {list.length ? (
              <ul className="divide-y divide-border">
                {list.map((x) => (
                  <FoodEntryRow
                    key={x.id}
                    entry={{ id: x.id, description: x.description, quantity: x.quantity, meal: x.meal, time: localTime(x.eaten_at, tz), calories: x.calories, createdAt: (x as { created_at?: string }).created_at, emoji: foodEmoji(x.description), photoUrl: x.photo_path && photoShownOn.get(x.photo_path) === x.id ? (photoUrl.get(x.photo_path) ?? null) : null }}
                    ownerId={ownerId}
                    date={date}
                    copyTo={people.filter((p) => p.id !== ownerId).map((p) => ({ id: p.id, name: p.name }))}
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
            ) : null}
            {canWrite && list.length ? (
              <div className="mt-1.5">
                <SaveMealButton entryIds={list.map((x) => x.id)} meal={meal} suggestion={`${isOwner ? "My" : `${session.subject.display_name}'s`} usual ${t(MEAL_META[meal].label).toLowerCase()}`} />
              </div>
            ) : null}
          </Card>
        );
      })}

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

      {canWrite && favourites.length ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">{t("Have it again")}</h2>
          <AgainChips ownerId={ownerId} day={day} foods={favourites.map((f) => ({ id: f.id, description: f.description, quantity: f.quantity, calories: f.calories, meal: f.meal }))} />
        </Card>
      ) : null}
    </div>
    </PullToRefresh>
  );
}
