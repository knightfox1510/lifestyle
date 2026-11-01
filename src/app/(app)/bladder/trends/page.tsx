import Link from "next/link";
import { getSession } from "@/lib/session";
import { shortDate } from "@/lib/dates";
import { Card, EmptyState, cx } from "@/components/ui";
import { BarList, ColumnChart, rollingAverage } from "@/components/charts";
import { comparisons, dailyStats, hourHistogram, leaksAfterCaffeine, physicalShare, trend, triggerCounts } from "@/modules/bladder/analysis";
import { loadDiary } from "@/modules/bladder/load";

export const metadata = { title: "Bladder trends" };

const PERIODS = [14, 30, 90];

export default async function BladderTrendsPage({ searchParams }: PageProps<"/bladder/trends">) {
  const session = await getSession();
  const { days: dParam } = await searchParams;
  const period = PERIODS.includes(Number(dParam)) ? Number(dParam) : 30;
  const ownerId = session.subject.user_id;
  const d = await loadDiary(session, ownerId, period);

  const stats = dailyStats(d.days, d.events, d.fluids, d.tz, d.sessions, d.workouts);
  const loggedDays = stats.filter((s) => s.leaks + s.urges + s.voids + s.fluidMl > 0).length;
  if (loggedDays === 0) {
    return <EmptyState title="No diary entries in this period">Log leaks, urges, bathroom visits and drinks for a few days to see patterns.</EmptyState>;
  }

  const leaks = stats.map((s) => s.leaks);
  const t = trend(stats);
  const caffeine = leaksAfterCaffeine(d.events, d.fluids);
  const share = physicalShare(d.events);
  const hours = hourHistogram(d.events, d.tz);
  const avgLeaks = Math.round((leaks.reduce((a, b) => a + b, 0) / Math.max(loggedDays, 1)) * 10) / 10;
  const avgFluid = Math.round(stats.reduce((a, s) => a + s.fluidMl, 0) / Math.max(loggedDays, 1));
  const avgVoids = Math.round((stats.reduce((a, s) => a + s.voids, 0) / Math.max(loggedDays, 1)) * 10) / 10;
  const dayLabel = (date: string) => shortDate(date);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/bladder/trends?days=${p}`}
            className={cx("rounded-full border px-3 py-1 text-sm", p === period ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}
          >
            {p} days
          </Link>
        ))}
      </div>
        <Link
          href={`/assistant?q=${encodeURIComponent("Look at my bladder diary and recent tracking. Which triggers should I work on first, what daily changes could help, and what should I ask my doctor or pelvic-floor physio?")}`}
          className="text-sm font-medium text-accent hover:underline"
        >
          ✨ Ask AI about these patterns
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Leaks / day" value={avgLeaks} sub={`${loggedDays} days logged`} />
        <Stat
          label="Trend"
          value={t ? `${t.change > 0 ? "+" : ""}${t.change}%` : "–"}
          sub={t ? `${t.first} → ${t.second} per day (first vs second half)` : "Needs 6+ logged days"}
          tone={t ? (t.change < 0 ? "good" : t.change > 0 ? "bad" : undefined) : undefined}
        />
        <Stat label="Bathroom / day" value={avgVoids} sub="Typical: 4–8 per day" />
        <Stat label="Fluids / day" value={`${(avgFluid / 1000).toFixed(1)} L`} sub="on logged days" />
      </div>

      <Card>
        <ColumnChart
          title="Leaks per day"
          subtitle={`Last ${period} days`}
          data={stats.map((s) => ({ key: s.date, label: dayLabel(s.date), value: s.leaks, tooltip: `${dayLabel(s.date)}: ${s.leaks} leak${s.leaks === 1 ? "" : "s"}, ${s.fluidMl} ml fluids${s.kegel ? ", Kegel ✓" : ""}${s.workouts.length ? `, ${s.workouts.join("+")}` : ""}` }))}
          line={rollingAverage(leaks)}
          barLabel="Leaks"
          lineLabel="7-day average"
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <BarList title="What was happening during leaks" items={triggerCounts(d.events).slice(0, 8)} />
          {share.total ? (
            <p className="mt-3 text-xs text-fg-muted">
              {Math.round((share.physical / share.total) * 100)}% of leaks happened with physical effort (cough, lifting, exercise…), which points to stress-type leaks.{" "}
              {Math.round((share.urge / share.total) * 100)}% came with a strong urge, which points to urge-type leaks.
            </p>
          ) : null}
        </Card>
        <Card>
          <ColumnChart
            title="Leaks by time of day"
            data={hours.map((v, h) => ({ key: String(h), label: `${h}`, value: v, tooltip: `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59: ${v} leak${v === 1 ? "" : "s"}` }))}
            height={120}
            labelEvery={3}
          />
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Possible links</h2>
        <p className="mb-3 text-xs text-fg-muted">Average leaks per logged day. Small samples can mislead, so check the day counts.</p>
        <ul className="divide-y divide-border">
          {comparisons(stats, d.checkins).map((c) => (
            <li key={c.label} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[9rem_1fr_1fr]">
              <span className="font-medium">{c.label}</span>
              <span>
                {c.a.label}: <strong className="tabular-nums">{c.a.value ?? "–"}</strong> <span className="text-xs text-fg-muted">({c.a.days} days)</span>
              </span>
              <span>
                {c.b.label}: <strong className="tabular-nums">{c.b.value ?? "–"}</strong> <span className="text-xs text-fg-muted">({c.b.days} days)</span>
              </span>
              {c.note ? <span className="text-xs text-fg-muted sm:col-span-3">{c.note}</span> : null}
            </li>
          ))}
          <li className="py-2.5 text-sm">
            <span className="font-medium">After caffeine:</span> {caffeine.after} of {caffeine.total} leaks happened within 2 hours of a caffeinated drink.
          </li>
        </ul>
      </Card>

      <Card>
        <ColumnChart
          title="Fluid intake per day"
          data={stats.map((s) => ({ key: s.date, label: dayLabel(s.date), value: s.fluidMl, tooltip: `${dayLabel(s.date)}: ${s.fluidMl} ml (${s.caffeineMl} ml caffeinated)` }))}
          unit=" ml"
          height={120}
        />
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "good" | "bad" }) {
  return (
    <Card className="!p-3.5">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {tone === "good" ? <span aria-label="improving">↓ </span> : tone === "bad" ? <span aria-label="worsening">↑ </span> : null}
        {value}
      </p>
      {sub ? <p className="text-xs text-fg-muted">{sub}</p> : null}
    </Card>
  );
}
