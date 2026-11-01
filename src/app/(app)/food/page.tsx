import Link from "next/link";
import { getSession } from "@/lib/session";
import { addDays, localDate, localTime, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card, buttonClass, cx } from "@/components/ui";
import type { FluidIntake, FoodEntry, NutritionGoals } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, totals } from "@/modules/food/meta";
import { FoodAiAdd } from "./food-ai-add";
import { ManualFoodForm } from "./manual-food-form";
import { deleteFood, repeatFood } from "./actions";

export const metadata = { title: "Food diary" };

export default async function FoodDiaryPage({ searchParams }: PageProps<"/food">) {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const { date: dParam } = await searchParams;
  const date = typeof dParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dParam) && dParam <= today ? dParam : today;
  const canWrite = session.accessTo("food_diary", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  const fluidsVisible = session.isModuleEnabled("bladder_diary") && session.accessTo("bladder_diary", ownerId) !== "none";

  const [{ data: e }, { data: g }, { data: recent }, fl] = await Promise.all([
    session.supabase.from("food_entries").select("*").eq("owner_id", ownerId).gte("eaten_at", startOfLocalDayIso(date)).lt("eaten_at", startOfLocalDayIso(addDays(date, 3))).order("eaten_at"),
    session.supabase.from("nutrition_goals").select("*").eq("owner_id", ownerId).maybeSingle(),
    session.supabase.from("food_entries").select("*").eq("owner_id", ownerId).order("eaten_at", { ascending: false }).limit(60),
    fluidsVisible
      ? session.supabase.from("fluid_intake").select("volume_ml, occurred_at").eq("owner_id", ownerId).gte("occurred_at", startOfLocalDayIso(date)).lt("occurred_at", startOfLocalDayIso(addDays(date, 3)))
      : Promise.resolve({ data: [] }),
  ]);
  const entries = ((e ?? []) as FoodEntry[]).filter((x) => localDate(x.eaten_at, tz) === date);
  const goals = g as NutritionGoals | null;
  const t = totals(entries);
  const water = ((fl.data ?? []) as Pick<FluidIntake, "volume_ml" | "occurred_at">[])
    .filter((x) => localDate(x.occurred_at, tz) === date)
    .reduce((a, x) => a + x.volume_ml, 0);

  const seen = new Set<string>();
  const favourites = ((recent ?? []) as FoodEntry[]).filter((x) => {
    const k = x.description.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 8);

  const bars: { label: string; value: number; goal: number | null; unit: string }[] = [
    { label: "Calories", value: t.calories, goal: goals?.calories ?? null, unit: "kcal" },
    { label: "Protein", value: t.protein_g, goal: goals?.protein_g ?? null, unit: "g" },
    { label: "Carbs", value: t.carbs_g, goal: goals?.carbs_g ?? null, unit: "g" },
    { label: "Fat", value: t.fat_g, goal: goals?.fat_g ?? null, unit: "g" },
    { label: "Fibre", value: t.fiber_g, goal: goals?.fiber_g ?? null, unit: "g" },
    ...(fluidsVisible ? [{ label: "Water & drinks", value: water, goal: goals?.water_ml ?? null, unit: "ml" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/food?date=${addDays(date, -1)}`} className={buttonClass("ghost", "sm")}>← {shortDate(addDays(date, -1))}</Link>
        <p className="font-semibold">{date === today ? "Today" : shortDate(date)}</p>
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
                <span className="font-medium">{b.label}</span>
                <span className="tabular-nums text-fg-muted">
                  <span className={cx("text-fg", over && b.label === "Calories" && "text-danger")}>{b.value.toLocaleString("en-IN")}</span>
                  {b.goal ? ` / ${b.goal.toLocaleString("en-IN")}` : ""} {b.unit}
                  {b.goal && b.label === "Calories" ? ` · ${b.goal - b.value >= 0 ? `${(b.goal - b.value).toLocaleString("en-IN")} left` : `${(b.value - b.goal).toLocaleString("en-IN")} over`}` : ""}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className={cx("h-full rounded-full", over && b.label === "Calories" ? "bg-danger" : "bg-series-1")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {!goals?.calories ? (
          <p className="text-xs text-fg-muted">
            <Link href="/food/goals" className="text-accent underline">Set your goals</Link> (AI can suggest them from your weight, activity and health).
          </p>
        ) : null}
      </Card>

      {canWrite && date === today ? (
        <>
          <FoodAiAdd ownerId={ownerId} />
          <ManualFoodForm ownerId={ownerId} />
        </>
      ) : null}

      {MEAL_ORDER.map((meal) => {
        const list = entries.filter((x) => x.meal === meal);
        const mt = totals(list);
        return (
          <Card key={meal} className="!p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="font-semibold">{MEAL_META[meal].icon} {MEAL_META[meal].label}</h2>
              <span className="text-sm tabular-nums text-fg-muted">{mt.calories} kcal</span>
            </div>
            {list.length ? (
              <ul className="divide-y divide-border">
                {list.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{x.description}{x.quantity ? <span className="text-fg-muted"> · {x.quantity}</span> : null}</span>
                      <span className="text-xs text-fg-muted">
                        {localTime(x.eaten_at, tz)} · P {Math.round(Number(x.protein_g ?? 0))} · C {Math.round(Number(x.carbs_g ?? 0))} · F {Math.round(Number(x.fat_g ?? 0))}
                        {x.source !== "manual" ? " · AI estimate" : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{x.calories ?? "–"}</span>
                      {isOwner ? (
                        <form action={deleteFood.bind(null, x.id)}>
                          <button className="text-xs text-fg-muted hover:text-danger" aria-label={`Delete ${x.description}`}>✕</button>
                        </form>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">Nothing logged.</p>
            )}
          </Card>
        );
      })}

      {canWrite && date === today && favourites.length ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Have it again</h2>
          <div className="flex flex-wrap gap-1.5">
            {favourites.map((f) => (
              <form key={f.id} action={repeatFood.bind(null, f.id, ownerId, f.meal)}>
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
