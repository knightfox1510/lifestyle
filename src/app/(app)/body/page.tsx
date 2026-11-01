import { getSession } from "@/lib/session";
import { addDays, dayOfWeek, lastNDays, localDate, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card, EmptyState, cx } from "@/components/ui";
import { LineChart } from "@/components/charts";
import type { BodyGoals, BodyMetric, FoodEntry, NutritionGoals } from "@/lib/types";
import { totals } from "@/modules/food/meta";
import { BodyGoalsForm, WeightForm } from "./forms";
import { deleteBodyMetric } from "./actions";

export const metadata = { title: "Body recomposition" };

export default async function BodyPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const canWrite = session.accessTo("body_recomp", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  const foodVisible = session.isModuleEnabled("food_diary") && session.accessTo("food_diary", ownerId) !== "none";
  const from = startOfLocalDayIso(addDays(today, -180));

  const [{ data: m }, { data: g }, food, ng] = await Promise.all([
    session.supabase.from("body_metrics").select("*").eq("owner_id", ownerId).gte("measured_at", from).order("measured_at"),
    session.supabase.from("body_goals").select("*").eq("owner_id", ownerId).maybeSingle(),
    foodVisible
      ? session.supabase.from("food_entries").select("eaten_at, calories, protein_g, carbs_g, fat_g, fiber_g").eq("owner_id", ownerId).gte("eaten_at", startOfLocalDayIso(addDays(today, -42)))
      : Promise.resolve({ data: [] }),
    foodVisible ? session.supabase.from("nutrition_goals").select("calories").eq("owner_id", ownerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const metrics = (m ?? []) as BodyMetric[];
  const goals = g as BodyGoals | null;
  const weights = metrics.filter((x) => x.weight_kg !== null).map((x) => ({ date: localDate(x.measured_at, tz), value: Number(x.weight_kg) }));
  // One point per day (last reading wins).
  const byDay = new Map(weights.map((w) => [w.date, w.value]));
  const daily = [...byDay.entries()].map(([date, value]) => ({ date, value }));
  const latest = daily.at(-1)?.value ?? null;
  const weekAgo = daily.filter((d) => d.date <= addDays(today, -7)).at(-1)?.value ?? null;
  const monthAgo = daily.filter((d) => d.date <= addDays(today, -30)).at(-1)?.value ?? null;
  const target = goals?.target_weight_kg != null ? Number(goals.target_weight_kg) : null;
  const start = goals?.start_weight_kg != null ? Number(goals.start_weight_kg) : daily[0]?.value ?? null;
  const progress = latest !== null && target !== null && start !== null && start !== target ? Math.max(0, Math.min(100, ((start - latest) / (start - target)) * 100)) : null;

  // Weekly (Mon–Sun) average intake vs weight change.
  const entries = ((food.data ?? []) as Pick<FoodEntry, "eaten_at" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g">[]);
  const weekStart = (d: string) => addDays(d, -((dayOfWeek(d) + 6) % 7));
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(weekStart(today), -7 * (5 - i)));
  const weekRows = weeks.map((ws) => {
    const days = lastNDays(addDays(ws, 6), 7).filter((d) => d <= today);
    const dayTotals = days.map((d) => totals(entries.filter((e) => localDate(e.eaten_at, tz) === d)).calories).filter((c) => c > 0);
    const w = daily.filter((x) => x.date >= ws && x.date <= addDays(ws, 6)).map((x) => x.value);
    return {
      ws,
      avgKcal: dayTotals.length ? Math.round(dayTotals.reduce((a, b) => a + b, 0) / dayTotals.length) : null,
      loggedDays: dayTotals.length,
      avgWeight: w.length ? Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10 : null,
    };
  });
  const kcalGoal = (ng.data as Pick<NutritionGoals, "calories"> | null)?.calories ?? null;
  const delta = (a: number | null) => (latest !== null && a !== null ? Math.round((latest - a) * 10) / 10 : null);
  const fmtDelta = (d: number | null) => (d === null ? "–" : `${d > 0 ? "+" : ""}${d} kg`);

  return (
    <div className="space-y-4">
      {canWrite ? <WeightForm ownerId={ownerId} last={latest} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Current</p>
          <p className="text-2xl font-semibold tabular-nums">{latest ?? "–"}<span className="text-sm font-normal text-fg-muted"> kg</span></p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">7 days</p>
          <p className="text-2xl font-semibold tabular-nums">{fmtDelta(delta(weekAgo))}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">30 days</p>
          <p className="text-2xl font-semibold tabular-nums">{fmtDelta(delta(monthAgo))}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">To target</p>
          <p className="text-2xl font-semibold tabular-nums">{latest !== null && target !== null ? `${Math.round(Math.abs(latest - target) * 10) / 10} kg` : "–"}</p>
          {target !== null ? <p className="text-xs text-fg-muted">target {target} kg{goals?.target_date ? ` by ${shortDate(goals.target_date)}` : ""}</p> : null}
        </Card>
      </div>

      {progress !== null ? (
        <Card className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Progress to {target} kg</span>
            <span className="tabular-nums text-fg-muted">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          {goals?.milestones.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {goals.milestones.map((ms) => {
                const reached = latest !== null && start !== null && (start > (target ?? 0) ? latest <= ms : latest >= ms);
                const firstHit = daily.find((d) => (start! > (target ?? 0) ? d.value <= ms : d.value >= ms));
                return (
                  <li key={ms} className={cx("rounded-full border px-2.5 py-1 text-xs", reached ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
                    {reached ? "🏁 " : ""}{ms} kg{reached && firstHit ? ` · ${shortDate(firstHit.date)}` : ""}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {canWrite ? <BodyGoalsForm ownerId={ownerId} goals={goals} current={latest} /> : null}

      {daily.length ? (
        <Card>
          <LineChart
            title="Weight"
            subtitle="Last 6 months"
            points={daily.map((d) => ({ date: d.date, value: d.value, label: shortDate(d.date), tooltip: `${shortDate(d.date)}: ${d.value} kg` }))}
            unit=" kg"
            target={target}
            targetLabel={target !== null ? `Target ${target} kg` : undefined}
          />
        </Card>
      ) : (
        <EmptyState title="No weigh-ins yet">Log your weight a few times a week (same time of day) for a reliable trend.</EmptyState>
      )}

      {foodVisible ? (
        <Card className="overflow-x-auto">
          <h2 className="mb-1 text-sm font-semibold">Calories vs. weight, by week</h2>
          <p className="mb-2 text-xs text-fg-muted">Average daily intake on logged days, next to average weight. A steady deficit should show as a slow downward weight trend.</p>
          <table className="w-full min-w-[420px] text-sm tabular-nums">
            <thead className="text-xs text-fg-muted">
              <tr>
                <th className="text-left font-medium">Week of</th>
                <th className="text-right font-medium">Avg kcal/day</th>
                <th className="text-right font-medium">Days logged</th>
                <th className="text-right font-medium">Avg weight</th>
                <th className="text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {weekRows.map((w, i) => {
                const prev = weekRows[i - 1]?.avgWeight ?? null;
                const ch = prev !== null && w.avgWeight !== null ? Math.round((w.avgWeight - prev) * 10) / 10 : null;
                return (
                  <tr key={w.ws} className="border-t border-border">
                    <td className="py-1.5 text-left">{shortDate(w.ws)}</td>
                    <td className={cx("text-right", Boolean(kcalGoal && w.avgKcal && w.avgKcal > kcalGoal * 1.05) && "text-danger")}>{w.avgKcal ?? "–"}{kcalGoal && w.avgKcal ? <span className="text-xs text-fg-muted"> / {kcalGoal}</span> : null}</td>
                    <td className="text-right text-fg-muted">{w.loggedDays}</td>
                    <td className="text-right">{w.avgWeight ?? "–"}</td>
                    <td className="text-right">{ch === null ? "–" : `${ch > 0 ? "+" : ""}${ch}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}

      {metrics.some((x) => x.waist_cm || x.hip_cm || x.body_fat_pct) ? (
        <Card className="overflow-x-auto">
          <h2 className="mb-2 text-sm font-semibold">Measurements</h2>
          <table className="w-full min-w-[480px] text-sm tabular-nums">
            <thead className="text-xs text-fg-muted">
              <tr><th className="text-left font-medium">Date</th><th className="text-right font-medium">Body fat</th><th className="text-right font-medium">Waist</th><th className="text-right font-medium">Hip</th><th className="text-right font-medium">Chest</th><th className="text-right font-medium">Arm</th><th className="text-right font-medium">Thigh</th><th /></tr>
            </thead>
            <tbody>
              {[...metrics].reverse().filter((x) => x.waist_cm || x.hip_cm || x.body_fat_pct || x.chest_cm || x.arm_cm || x.thigh_cm).slice(0, 12).map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="py-1.5 text-left">{shortDate(localDate(x.measured_at, tz))}</td>
                  <td className="text-right">{x.body_fat_pct ? `${x.body_fat_pct}%` : "–"}</td>
                  <td className="text-right">{x.waist_cm ?? "–"}</td>
                  <td className="text-right">{x.hip_cm ?? "–"}</td>
                  <td className="text-right">{x.chest_cm ?? "–"}</td>
                  <td className="text-right">{x.arm_cm ?? "–"}</td>
                  <td className="text-right">{x.thigh_cm ?? "–"}</td>
                  <td className="text-right">
                    {isOwner ? (
                      <form action={deleteBodyMetric.bind(null, x.id)}>
                        <button className="text-xs text-fg-muted hover:text-danger" aria-label="Delete entry">✕</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {weights.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-fg-muted">All weigh-ins</summary>
          <ul className="mt-2 divide-y divide-border">
            {[...metrics].reverse().filter((x) => x.weight_kg !== null).map((x) => (
              <li key={x.id} className="flex justify-between py-1.5">
                <span>{shortDate(localDate(x.measured_at, tz))} · {x.weight_kg} kg</span>
                {isOwner ? (
                  <form action={deleteBodyMetric.bind(null, x.id)}>
                    <button className="text-xs text-fg-muted hover:text-danger" aria-label="Delete weigh-in">✕</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
