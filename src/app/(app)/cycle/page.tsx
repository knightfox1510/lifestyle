import Link from "next/link";
import { getSession } from "@/lib/session";
import { addDays, dayOfWeek, localDate, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card, buttonClass, cx } from "@/components/ui";
import { DateJump } from "@/components/date-jump";
import { PHASE_LABEL, cycleStats, cycleStatus, leaksByPhase, periodsFrom, phaseOn, type CycleDay, type Flow } from "@/modules/cycle/logic";
import { DayLogger, PeriodStartedButton } from "./day-logger";

export const metadata = { title: "Cycle" };

const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const nextMonth = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};
const prevMonth = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
};
const monthName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function CyclePage({ searchParams }: PageProps<"/cycle">) {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const isSelf = ownerId === session.userId;
  const canWrite = session.accessTo("cycle", ownerId) === "write";
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const { date: dParam } = await searchParams;
  const date = typeof dParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dParam) && dParam <= today ? dParam : today;
  const since = addDays(today, -400);
  const bladderOn = session.isModuleEnabled("bladder_diary") && session.accessTo("bladder_diary", ownerId) !== "none";

  const [{ data, error }, bl] = await Promise.all([
    session.supabase.from("cycle_days").select("day, flow, symptoms, notes").eq("owner_id", ownerId).gte("day", since).order("day"),
    bladderOn
      ? session.supabase.from("bladder_events").select("kind, occurred_at").eq("owner_id", ownerId).gte("occurred_at", startOfLocalDayIso(addDays(today, -180))).limit(5000)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) {
    return <Card><p className="text-sm">The cycle tracker needs the latest database update: run <code>supabase/setup/update-existing-database.sql</code> in the Supabase SQL Editor.</p></Card>;
  }
  const days = (data ?? []) as (CycleDay & { notes: string | null })[];
  const byDay = new Map(days.map((d) => [d.day, d]));
  const periods = periodsFrom(days);
  const stats = cycleStats(periods);
  const status = cycleStatus(periods, today);
  const sel = byDay.get(date);

  // Calendar: last month, this month, next month (predictions).
  const months = [prevMonth(monthStart(today)), monthStart(today), nextMonth(monthStart(today))];
  const predicted = new Set<string>();
  if (status.nextStart) for (let i = 0; i < stats.period; i++) predicted.add(addDays(status.nextStart, i));
  const fertile = new Set<string>();
  if (status.fertile) for (let d = status.fertile.start; d <= status.fertile.end; d = addDays(d, 1)) fertile.add(d);

  // Bladder by phase.
  const bev = (bl.data ?? []) as { kind: string; occurred_at: string }[];
  const leakDays = new Map<string, number>();
  const logged = new Set<string>();
  for (const e of bev) {
    const d = localDate(e.occurred_at, tz);
    logged.add(d);
    if (e.kind === "leak") leakDays.set(d, (leakDays.get(d) ?? 0) + 1);
  }
  const byPhase = bladderOn && periods.length ? leaksByPhase(periods, leakDays, logged) : [];

  const headline = status.cycleDay === null
    ? "Log the first day of your last period to start."
    : status.inPeriod
      ? `Period · day ${status.cycleDay}`
      : status.late > 0
        ? `Period ${status.late} day${status.late === 1 ? "" : "s"} later than usual`
        : `Cycle day ${status.cycleDay}`;

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <p className="text-2xl font-semibold tracking-tight">{headline}</p>
        {status.nextStart && !status.inPeriod ? (
          <p className="text-sm text-fg-muted">
            {status.late > 0 ? `Expected ${shortDate(status.nextStart)}.` : `Next period expected around ${shortDate(status.nextStart)}${status.daysUntilNext !== null ? ` (in ${status.daysUntilNext} day${status.daysUntilNext === 1 ? "" : "s"})` : ""}.`}
            {status.phase ? ` Now: ${PHASE_LABEL[status.phase].toLowerCase()}.` : ""}
          </p>
        ) : null}
        <p className="text-xs text-fg-muted">
          {stats.known
            ? `Typical cycle ${stats.cycle} days (from ${stats.cycles} cycle${stats.cycles === 1 ? "" : "s"}), period ${stats.period} days${stats.regular === false ? ` · lengths vary by ${stats.spread} days` : ""}.`
            : "Predictions use a 28-day cycle until two periods are logged."}
          {status.fertile ? ` Fertile window (estimate): ${shortDate(status.fertile.start)}–${shortDate(status.fertile.end)}. Not reliable for contraception.` : ""}
        </p>
        {canWrite && !byDay.get(today)?.flow ? <PeriodStartedButton ownerId={ownerId} day={today} label={isSelf ? "My period started today" : "Period started today"} /> : null}
      </Card>

      {canWrite ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/cycle?date=${addDays(date, -1)}`} className={buttonClass("ghost", "sm")}>← {shortDate(addDays(date, -1))}</Link>
            <DateJump date={date} today={today} basePath="/cycle" label={date === today ? "Today" : shortDate(date)} />
            {date < today ? (
              <Link href={date === addDays(today, -1) ? "/cycle" : `/cycle?date=${addDays(date, 1)}`} className={buttonClass("ghost", "sm")}>{shortDate(addDays(date, 1))} →</Link>
            ) : (
              <span className="w-20" />
            )}
          </div>
          <DayLogger key={date} ownerId={ownerId} day={date} initial={{ flow: (sel?.flow ?? null) as Flow | null, symptoms: sel?.symptoms ?? [], notes: sel?.notes ?? null }} />
        </Card>
      ) : null}

      <Card className="space-y-4">
        {months.map((m) => {
          const lead = (dayOfWeek(m) + 6) % 7;
          const cells: (string | null)[] = [...Array(lead).fill(null)];
          for (let d = m; d < nextMonth(m); d = addDays(d, 1)) cells.push(d);
          return (
            <div key={m}>
              <p className="mb-1.5 text-sm font-semibold">{monthName(m)}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
                  <span key={i} className="text-fg-muted">{l}</span>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <span key={`e${i}`} />;
                  const entry = byDay.get(d);
                  const bleeding = entry?.flow && entry.flow !== "spotting";
                  const future = d > today;
                  return (
                    <Link
                      key={d}
                      href={future ? "#" : d === today ? "/cycle" : `/cycle?date=${d}`}
                      aria-label={`${shortDate(d)}${entry?.flow ? `, ${entry.flow}` : ""}`}
                      className={cx(
                        "relative flex aspect-square items-center justify-center rounded-full tabular-nums",
                        bleeding && "bg-danger font-semibold text-white",
                        entry?.flow === "spotting" && "bg-danger-soft",
                        !entry?.flow && predicted.has(d) && "border border-dashed border-danger",
                        !entry?.flow && !predicted.has(d) && fertile.has(d) && "bg-accent-soft",
                        d === date && "ring-2 ring-accent",
                        future && "pointer-events-none",
                        !entry?.flow && !predicted.has(d) && !fertile.has(d) && "text-fg-muted",
                      )}
                    >
                      {Number(d.slice(8))}
                      {entry?.symptoms.length ? <span aria-hidden className="absolute bottom-0.5 size-1 rounded-full bg-accent" /> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-fg-muted">
          <span className="mr-1 inline-block size-2.5 rounded-full bg-danger align-middle" /> period ·{" "}
          <span className="mx-1 inline-block size-2.5 rounded-full border border-dashed border-danger align-middle" /> expected ·{" "}
          <span className="mx-1 inline-block size-2.5 rounded-full bg-accent-soft align-middle" /> fertile (estimate) · dot = symptoms logged
        </p>
      </Card>

      {byPhase.some((p) => p.days >= 3) ? (
        <Card>
          <h2 className="mb-1 text-sm font-semibold">Bladder through the cycle</h2>
          <p className="mb-2 text-xs text-fg-muted">Average leaks per logged diary day in each phase. Hormone changes before and during a period often make urgency and leaks worse.</p>
          <ul className="divide-y divide-border text-sm">
            {byPhase.map((p) => (
              <li key={p.phase} className="flex justify-between py-2">
                <span>{PHASE_LABEL[p.phase]}</span>
                <span className="tabular-nums">
                  <strong>{p.avg ?? "–"}</strong> <span className="text-xs text-fg-muted">leaks/day · {p.days} days</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {periods.length ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Recent periods</h2>
          <ul className="divide-y divide-border text-sm">
            {[...periods].reverse().slice(0, 8).map((p, i, arr) => {
              const prev = arr[i + 1];
              const len = prev ? Math.round((Date.parse(p.start) - Date.parse(prev.start)) / 864e5) : null;
              return (
                <li key={p.start} className="flex justify-between py-2">
                  <span>{shortDate(p.start)} · {p.days} day{p.days === 1 ? "" : "s"}</span>
                  <span className="text-fg-muted">{len ? `${len}-day cycle` : ""}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-fg-muted">
            Talk to a doctor if cycles are often shorter than 21 or longer than 35 days, a period lasts over 7 days, or bleeding is very heavy.
            {phaseOn(periods, today) === null && status.late > 7 ? " Your period is more than a week late." : ""}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
