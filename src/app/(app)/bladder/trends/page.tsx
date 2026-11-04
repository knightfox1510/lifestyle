import Link from "next/link";
import { getSession } from "@/lib/session";
import { shortDate } from "@/lib/dates";
import { Card, EmptyState, cx } from "@/components/ui";
import { BarList, ColumnChart, rollingAverage } from "@/components/charts";
import { comparisons, dailyStats, hourHistogram, leaksAfterCaffeine, loggedRollingAverage, physicalShare, trend, triggerCounts, weekdayPattern, weeklyStats, weeklyTrend } from "@/modules/bladder/analysis";
import { loadDiary, loadDiaryEvents } from "@/modules/bladder/load";
import { beforeAfter, daysBetween } from "@/modules/bladder/events";
import { getT } from "@/lib/i18n/server";
import { afterExposures } from "@/modules/bladder/exposures";
import { PHASE_LABEL, leaksByPhase, periodsFrom, type CycleDay } from "@/modules/cycle/logic";

export const metadata = { title: "Bladder trends" };

const PERIODS = [14, 30, 90, 180];

export default async function BladderTrendsPage({ searchParams }: PageProps<"/bladder/trends">) {
  const session = await getSession();
  const { days: dParam } = await searchParams;
  const period = PERIODS.includes(Number(dParam)) ? Number(dParam) : 30;
  const ownerId = session.subject.user_id;
  const [d, health, tr] = await Promise.all([loadDiary(session, ownerId, period), loadDiaryEvents(session, ownerId, "1900-01-01"), getT(session)]);

  const stats = dailyStats(d.days, d.events, d.fluids, d.tz, d.sessions, d.workouts, d.foods);
  // The period before, for the dashed "previous" line (days with nothing logged are skipped).
  const before = await loadDiary(session, ownerId, period * 2);
  const prevStats = dailyStats(before.days.slice(0, period), before.events, before.fluids, before.tz, before.sessions, before.workouts, before.foods);
  const prevLeaks = prevStats.map((s) => (s.leaks + s.urges + s.voids + s.fluidMl === 0 ? null : s.leaks));
  const hasPrev = prevLeaks.filter((v) => v != null).length >= 3;
  const loggedDays = stats.filter((s) => s.leaks + s.urges + s.voids + s.fluidMl > 0).length;
  if (loggedDays === 0) {
    return <EmptyState title="No diary entries in this period">Log leaks, urges, bathroom visits and drinks for a few days to see patterns.</EmptyState>;
  }

  const t = trend(stats);
  // Weekly view always looks back at least 12 weeks, whatever period is picked.
  const wk = period >= 84 ? d : await loadDiary(session, ownerId, 84);
  const wkStats = period >= 84 ? stats : dailyStats(wk.days, wk.events, wk.fluids, wk.tz, wk.sessions, wk.workouts, wk.foods);
  const weeks = weeklyStats(wkStats).filter((w, i, all) => w.days > 0 || all.slice(0, i).some((x) => x.days > 0));
  const wTrend = weeklyTrend(weeks);
  const thisWeek = weeks.at(-1);
  const lastWeek = weeks.at(-2);
  const weekdays = weekdayPattern(wkStats);
  const caffeine = leaksAfterCaffeine(d.events, d.fluids);
  const loggedDates = stats.filter((s) => s.leaks + s.urges + s.voids + s.fluidMl > 0).map((s) => s.date);
  const after = afterExposures(d.events, d.fluids, d.foods, loggedDates, d.tz, 2);
  // Cycle phases (cycle tracker), with periods looked up over the whole last year.
  const cycleOn = session.isModuleEnabled("cycle") && session.accessTo("cycle", ownerId) !== "none";
  const cycleRows = cycleOn ? ((await session.supabase.from("cycle_days").select("day, flow, symptoms").eq("owner_id", ownerId).gte("day", d.days[0].slice(0, 4) + "-01-01").order("day")).data ?? []) as CycleDay[] : [];
  const byPhase = cycleRows.length ? leaksByPhase(periodsFrom(cycleRows), new Map(stats.map((s) => [s.date, s.leaks])), loggedDates) : [];
  const share = physicalShare(d.events);
  const hours = hourHistogram(d.events, d.tz);
  const avgLeaks = Math.round((stats.reduce((a, s) => a + s.leaks, 0) / Math.max(loggedDays, 1)) * 10) / 10;
  const avgFluid = Math.round(stats.reduce((a, s) => a + s.fluidMl, 0) / Math.max(loggedDays, 1));
  const avgVoids = Math.round((stats.reduce((a, s) => a + s.voids, 0) / Math.max(loggedDays, 1)) * 10) / 10;
  const dayLabel = (date: string) => shortDate(date);
  const inRange = health.filter((h) => h.start_date >= d.days[0]);
  const markers = inRange.map((h) => ({ key: h.start_date, label: h.title }));
  const surgery = health.find((h) => h.category === "surgery");
  // Before vs after the latest event that has a week of diary on both sides (or the latest one).
  const logged = stats.map((s) => ({ date: s.date, leaks: s.leaks, logged: s.leaks + s.urges + s.voids + s.fluidMl > 0 }));
  const compared = inRange
    .filter((h) => h.category !== "surgery" || inRange.length === 1)
    .map((h) => ({ h, r: beforeAfter(logged, h.start_date) }))
    .filter((x) => x.r.before != null || x.r.after != null);

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Leaks / day" value={avgLeaks} sub={`${loggedDays} days logged`} />
        <Stat
          label="This week"
          value={thisWeek?.perDay ?? "–"}
          sub={lastWeek?.perDay != null ? `leaks/day · last week ${lastWeek.perDay}${thisWeek?.change != null ? ` (${thisWeek.change > 0 ? "+" : ""}${thisWeek.change}%)` : ""}` : "leaks/day"}
          tone={thisWeek?.change != null ? (thisWeek.change < 0 ? "good" : thisWeek.change > 0 ? "bad" : undefined) : undefined}
        />
        <Stat
          label="Weekly trend"
          value={wTrend ? `${wTrend.pctPerWeek > 0 ? "+" : ""}${wTrend.pctPerWeek}%` : t ? `${t.change > 0 ? "+" : ""}${t.change}%` : "–"}
          sub={wTrend ? `per week over ${wTrend.weeks} weeks (${wTrend.perWeek > 0 ? "+" : ""}${wTrend.perWeek} leaks/day each week)` : t ? `${t.first} → ${t.second} per day (first vs second half)` : "Needs 3 weeks or 6+ days"}
          tone={(wTrend?.pctPerWeek ?? t?.change ?? 0) < 0 ? "good" : (wTrend?.pctPerWeek ?? t?.change ?? 0) > 0 ? "bad" : undefined}
        />
        <Stat label="Bathroom / day" value={avgVoids} sub="Typical: 4–8 per day" />
        <Stat label="Fluids / day" value={`${(avgFluid / 1000).toFixed(1)} L`} sub="on logged days" />
      </div>

      {surgery || compared.length ? (
        <Card className="space-y-2">
          {surgery ? (
            <p className="text-sm">
              <strong>{tr("Day {n} after surgery", { n: daysBetween(surgery.start_date, d.today) })}</strong>
              <span className="text-fg-muted"> · {surgery.title} · {shortDate(surgery.start_date)}</span>
            </p>
          ) : null}
          {compared.slice(0, 3).map(({ h, r }) => (
            <p key={h.id} className="text-sm">
              <span className="font-medium">{h.title}</span> <span className="text-fg-muted">({shortDate(h.start_date)})</span>:{" "}
              {tr("{a} leaks/day in the week before, {b} in the week after", { a: r.before ?? "–", b: r.after ?? "–" })}
              {r.change != null ? (
                <span className={cx("ml-1 font-medium", r.change < 0 ? "text-accent" : r.change > 0 ? "text-danger" : "")}>
                  ({r.change > 0 ? "+" : ""}
                  {r.change}%)
                </span>
              ) : null}
              <span className="text-xs text-fg-muted"> · {tr("{b} and {a} days logged", { b: r.beforeDays, a: r.afterDays })}</span>
            </p>
          ))}
        </Card>
      ) : null}

      {after.results.length ? (
        <Card>
          <h2 className="mb-1 text-sm font-semibold">What happens after you eat or drink</h2>
          <p className="mb-3 text-xs text-fg-muted">
            How often a leak or strong urge followed within {after.hours} hours of each drink or irritant food.
            {after.usual !== null ? ` For comparison, any ${after.hours}-hour stretch of the day had one ${Math.round(after.usual * 100)}% of the time.` : ""}
          </p>
          <ul className="divide-y divide-border">
            {after.results.slice(0, 10).map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{r.label}</span> <span className="text-xs text-fg-muted">· {r.count} times</span>
                  {r.likely ? <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium">likely trigger</span> : null}
                </span>
                <span className="text-right tabular-nums">
                  <strong className={cx(r.likely && "text-danger")}>{Math.round(r.rate * 100)}%</strong>
                  <span className="block text-xs text-fg-muted">{r.medianMinutes !== null ? `next bathroom/urge ~${r.medianMinutes} min after` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-fg-muted">
            Needs at least 3 examples to show and 5 to flag. Log drinks with the time you had them for this to work well. A trigger is worth testing by cutting it for 1–2 weeks, with your doctor or physio&apos;s okay.
          </p>
        </Card>
      ) : null}

      {byPhase.some((p) => p.days >= 3) ? (
        <Card>
          <h2 className="mb-1 text-sm font-semibold">Through the menstrual cycle</h2>
          <p className="mb-2 text-xs text-fg-muted">Average leaks per logged day in each phase (from the cycle tracker).</p>
          <ul className="divide-y divide-border text-sm">
            {byPhase.map((p) => (
              <li key={p.phase} className="flex justify-between py-2">
                <span>{PHASE_LABEL[p.phase]}</span>
                <span className="tabular-nums"><strong>{p.avg ?? "–"}</strong> <span className="text-xs text-fg-muted">· {p.days} days</span></span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <ColumnChart
          markers={markers}
          title="Leaks per day"
          subtitle={`Last ${period} days · the line skips days with nothing logged`}
          data={stats.map((s) => ({
            key: s.date,
            label: dayLabel(s.date),
            value: s.leaks,
            tooltip: s.leaks + s.urges + s.voids + s.fluidMl === 0 ? `${dayLabel(s.date)}: nothing logged` : `${dayLabel(s.date)}: ${s.leaks} leak${s.leaks === 1 ? "" : "s"}, ${s.urges} urges, ${s.fluidMl} ml fluids${s.kegel ? ", Kegel ✓" : ""}${s.workouts.length ? `, ${s.workouts.join("+")}` : ""}`,
          }))}
          line={loggedRollingAverage(stats)}
          barLabel="Leaks"
          lineLabel="7-day average"
          compare={hasPrev ? prevLeaks : undefined}
          compareLabel={`Previous ${period} days`}
        />
      </Card>

      {weeks.length >= 2 ? (
        <Card className="space-y-3">
          <ColumnChart
            title="Week by week"
            subtitle={wTrend ? `Leaks per logged day each week · ${wTrend.pctPerWeek < 0 ? `falling about ${-wTrend.pctPerWeek}% a week` : wTrend.pctPerWeek > 0 ? `rising about ${wTrend.pctPerWeek}% a week` : "steady"}` : "Leaks per logged day each week (Mon–Sun)"}
            data={weeks.map((w) => ({ key: w.start, label: shortDate(w.start), value: w.perDay ?? 0, tooltip: `Week of ${shortDate(w.start)}: ${w.perDay ?? "–"} leaks/day over ${w.days} logged day${w.days === 1 ? "" : "s"}` }))}
            line={rollingAverage(weeks.map((w) => w.perDay ?? 0), 3)}
            barLabel="Leaks per day"
            lineLabel="3-week average"
            height={140}
            markers={markers.map((m) => ({ ...m, key: weeks.findLast((w) => w.start <= m.key)?.start ?? m.key }))}
          />
          <ul className="divide-y divide-border text-sm">
            {[...weeks].reverse().slice(0, 6).map((w) => (
              <li key={w.start} className="flex items-center justify-between gap-2 py-1.5">
                <span>Week of {shortDate(w.start)} <span className="text-xs text-fg-muted">· {w.days} day{w.days === 1 ? "" : "s"} logged</span></span>
                <span className="tabular-nums">
                  <strong>{w.perDay ?? "–"}</strong> <span className="text-xs text-fg-muted">leaks/day · {w.urgesPerDay ?? "–"} urges · {w.voidsPerDay ?? "–"} bathroom</span>
                  {w.change != null ? <span className={cx("ml-2 text-xs font-medium", w.change < 0 ? "text-accent" : w.change > 0 ? "text-danger" : "text-fg-muted")}>{w.change > 0 ? "▲" : w.change < 0 ? "▼" : "="} {Math.abs(w.change)}%</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-fg-muted">Weeks with fewer than 3 logged days don&apos;t count towards the trend.</p>
        </Card>
      ) : null}

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
            labelEvery={6}
          />
        </Card>
        {weekdays.some((w) => w.days >= 2) ? (
          <Card>
            <BarList title="Leaks per day by weekday (last 12 weeks)" items={weekdays.map((w) => ({ label: `${w.name} (${w.days}d)`, value: w.perDay ?? 0 }))} />
          </Card>
        ) : null}
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
