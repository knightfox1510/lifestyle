import Link from "next/link";
import { getSession } from "@/lib/session";
import { addDays, shortDate, shortDay } from "@/lib/dates";
import { Card, EmptyState, buttonClass } from "@/components/ui";
import { ColumnChart } from "@/components/charts";
import { MicroPanel } from "@/components/micro-panel";
import { weekNutrition } from "@/lib/nutrition/week";
import { supplementNutrientsByDay } from "@/lib/supplement-nutrients";
import { supplementTotals } from "@/modules/nutrition/supplements";
import { NUTRIENT_META, formatNutrient } from "@/modules/nutrition/nutrients";
import { ReportTips } from "./tips";

export const metadata = { title: "Weekly nutrition report" };

export default async function NutritionReportPage({ searchParams }: PageProps<"/food/report">) {
  const session = await getSession();
  const { week } = await searchParams;
  const r = await weekNutrition(session, session.subject.user_id, typeof week === "string" ? week : undefined);
  const suppByDay = await supplementNutrientsByDay(session, session.subject.user_id, r.days[0], r.days[r.days.length - 1]);
  const suppWeek = supplementTotals(Object.values(suppByDay).map((n) => ({ nutrients: n as Record<string, unknown> })));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/food/report?week=${addDays(r.monday, -7)}`} className={buttonClass("ghost", "sm")}>← Previous</Link>
        <p className="font-semibold">Week of {shortDate(r.monday)}</p>
        <Link href={`/food/report?week=${addDays(r.monday, 7)}`} className={buttonClass("ghost", "sm")}>Next →</Link>
      </div>

      {!r.logged ? (
        <EmptyState title="No food logged this week" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["calories", "protein_g", "carbs_g", "fat_g"] as const).map((k) => {
              const goal = r.goals?.[k];
              return (
                <Card key={k} className="!p-3.5">
                  <p className="text-xs text-fg-muted">{NUTRIENT_META[k].label} / day</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatNutrient(k, r.avg[k])}</p>
                  {goal ? <p className="text-xs text-fg-muted">goal {goal} {NUTRIENT_META[k].unit}</p> : null}
                </Card>
              );
            })}
          </div>

          <Card>
            <ColumnChart
              title="Calories by day"
              subtitle={`${r.logged} of 7 days logged`}
              data={r.byDay.map((d) => ({ key: d.date, label: shortDay(d.date), value: Math.round(d.n.calories ?? 0), tooltip: `${shortDate(d.date)}: ${Math.round(d.n.calories ?? 0)} kcal, ${Math.round(d.n.protein_g ?? 0)} g protein` }))}
              unit=" kcal"
              height={130}
            />
          </Card>

          <ReportTips week={r.monday} />
          {session.isShown("body_recomp") && session.accessTo("body_recomp", session.subject.user_id) !== "none" ? (
            <Link href="/body/coach" className="block rounded-2xl bg-accent-soft px-4 py-3 text-sm hover:opacity-90">
              ✨ <strong>AI coach:</strong> a fat-loss or weight plan that also looks at your weight trend, sleep, wearables, workouts, medicines and blood tests →
            </Link>
          ) : null}

          <Card>
            <h2 className="mb-2 text-sm font-semibold">Vitamins & minerals</h2>
            <MicroPanel totals={r.total} targets={r.targets} labLinks={r.labLinks} coverage={r.coverage} days={Math.max(1, r.logged)} supplements={suppWeek} />
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Biggest calorie sources</h2>
              <ol className="space-y-1 text-sm">
                {r.top.calories.map((x) => (
                  <li key={x.name} className="flex justify-between gap-2"><span className="truncate">{x.name} <span className="text-xs text-fg-muted">×{x.times}</span></span><span className="tabular-nums text-fg-muted">{Math.round(x.n.calories ?? 0)} kcal</span></li>
                ))}
              </ol>
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Top protein sources</h2>
              <ol className="space-y-1 text-sm">
                {r.top.protein_g.map((x) => (
                  <li key={x.name} className="flex justify-between gap-2"><span className="truncate">{x.name}</span><span className="tabular-nums text-fg-muted">{Math.round(x.n.protein_g ?? 0)} g</span></li>
                ))}
              </ol>
              {r.top.sodium_mg.length ? <p className="mt-2 text-xs text-fg-muted">Most sodium: {r.top.sodium_mg.map((x) => x.name).join(", ")}</p> : null}
            </Card>
          </div>

          <Card className="text-sm">
            {r.irritantDays ? <p>🚽 {r.irritantDays} day{r.irritantDays === 1 ? "" : "s"} with 2+ bladder irritants (see Bladder → Trends for the link with leaks).</p> : <p>No days with several bladder irritants.</p>}
            {r.restaurantItems ? <p>🍔 {r.restaurantItems} restaurant item{r.restaurantItems === 1 ? "" : "s"} this week.</p> : null}
          </Card>
        </>
      )}
    </div>
  );
}
