import Link from "next/link";
import { getSession } from "@/lib/session";
import { localDate, localTime, shortDate } from "@/lib/dates";
import { Card, EmptyState, cx } from "@/components/ui";
import { dailyStats, physicalShare, triggerCounts, trend } from "@/modules/bladder/analysis";
import { loadDiary } from "@/modules/bladder/load";
import { AMOUNT_LABEL, DRINK_META, KIND_META, TRIGGER_LABEL } from "@/modules/bladder/meta";
import type { Medicine } from "@/lib/types";
import { PrintButton } from "./print-button";

export const metadata = { title: "Bladder diary report" };

const PERIODS = [3, 7, 30];

export default async function BladderReportPage({ searchParams }: PageProps<"/bladder/report">) {
  const session = await getSession();
  const { days: dParam } = await searchParams;
  const period = PERIODS.includes(Number(dParam)) ? Number(dParam) : 7;
  const subject = session.subject;
  const d = await loadDiary(session, subject.user_id, period);
  const stats = dailyStats(d.days, d.events, d.fluids, d.tz, d.sessions, d.workouts);
  const logged = stats.filter((s) => s.leaks + s.urges + s.voids + s.fluidMl > 0);
  const n = Math.max(logged.length, 1);
  const sum = (k: "leaks" | "urges" | "voids" | "fluidMl" | "caffeineMl" | "padChanges") => logged.reduce((a, s) => a + s[k], 0);
  const share = physicalShare(d.events);
  const t = trend(stats);

  let meds: Medicine[] = [];
  if (session.isModuleEnabled("medicines") && session.accessTo("medicines", subject.user_id) !== "none") {
    const { data } = await session.supabase.from("medicines").select("*").eq("owner_id", subject.user_id).eq("active", true);
    meds = (data ?? []) as Medicine[];
  }

  const detailedDays = period <= 7 ? d.days : d.days.slice(-3);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/bladder/report?days=${p}`}
              className={cx("rounded-full border px-3 py-1 text-sm", p === period ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}
            >
              {p} days
            </Link>
          ))}
        </div>
        <PrintButton />
      </div>

      {logged.length === 0 ? (
        <EmptyState title="Nothing logged in this period" />
      ) : (
        <article className="space-y-5 rounded-2xl border border-border bg-surface p-5 text-sm print:border-0 print:p-0">
          <header className="border-b border-border pb-3">
            <h2 className="text-lg font-semibold">Bladder diary: {subject.display_name}</h2>
            <p className="text-fg-muted">
              {shortDate(d.days[0])} – {shortDate(d.today)} · {logged.length} of {period} days logged · generated {shortDate(d.today)}
            </p>
          </header>

          <section>
            <h3 className="mb-2 font-semibold">Summary (averages per logged day)</h3>
            <table className="w-full">
              <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:py-1">
                <tr><td>Leak episodes</td><td className="text-right tabular-nums">{(sum("leaks") / n).toFixed(1)}</td></tr>
                <tr><td>Urge episodes (without leak)</td><td className="text-right tabular-nums">{(sum("urges") / n).toFixed(1)}</td></tr>
                <tr><td>Toilet visits</td><td className="text-right tabular-nums">{(sum("voids") / n).toFixed(1)}</td></tr>
                <tr><td>Fluid intake</td><td className="text-right tabular-nums">{Math.round(sum("fluidMl") / n)} ml</td></tr>
                <tr><td>of which caffeinated</td><td className="text-right tabular-nums">{Math.round(sum("caffeineMl") / n)} ml</td></tr>
                <tr><td>Pad changes</td><td className="text-right tabular-nums">{(sum("padChanges") / n).toFixed(1)}</td></tr>
                <tr><td>Leaks with physical effort / with strong urge</td><td className="text-right tabular-nums">{share.physical} / {share.urge} of {share.total}</td></tr>
                {t ? <tr><td>Leaks per day, first half → second half</td><td className="text-right tabular-nums">{t.first} → {t.second} ({t.change > 0 ? "+" : ""}{t.change}%)</td></tr> : null}
                <tr><td>Pelvic floor sessions</td><td className="text-right tabular-nums">{d.sessions.filter((s) => s.completed).length}</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="mb-1 font-semibold">Most common circumstances of leaks</h3>
            <p>{triggerCounts(d.events).slice(0, 6).map((x) => `${x.label} (${x.value})`).join(", ") || "None recorded"}</p>
          </section>

          {meds.length ? (
            <section>
              <h3 className="mb-1 font-semibold">Current medicines</h3>
              <p>{meds.map((m) => [m.name, m.strength, m.times.length ? `${m.times.length}×/day` : "as needed"].filter(Boolean).join(" ")).join("; ")}</p>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 font-semibold">Daily totals</h3>
            <table className="w-full text-right tabular-nums">
              <thead className="text-xs text-fg-muted">
                <tr><th className="text-left font-medium">Day</th><th className="text-left font-medium">Exercise</th><th className="font-medium">Leaks</th><th className="font-medium">Urges</th><th className="font-medium">Toilet</th><th className="font-medium">Fluids ml</th><th className="font-medium">Caffeine ml</th><th className="font-medium">Pads</th></tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-1">
                {stats.map((s) => (
                  <tr key={s.date}>
                    <td className="text-left">{shortDate(s.date)}</td><td className="text-left text-xs">{s.workouts.join(", ")}</td><td>{s.leaks}</td><td>{s.urges}</td><td>{s.voids}</td><td>{s.fluidMl}</td><td>{s.caffeineMl}</td><td>{s.padChanges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="break-before-page">
            <h3 className="mb-2 font-semibold">Detailed diary{period > 7 ? " (last 3 days)" : ""}</h3>
            {detailedDays.map((day) => {
              const rows = [
                ...d.events.filter((e) => localDate(e.occurred_at, d.tz) === day).map((e) => ({
                  at: e.occurred_at,
                  intake: "",
                  output: `${KIND_META[e.kind].label}${e.amount ? ` (${AMOUNT_LABEL[e.amount].toLowerCase()})` : ""}${e.pad_changed ? ", pad changed" : ""}`,
                  urgency: e.urgency ? `${e.urgency}/5` : "",
                  activity: [...e.triggers.map((x) => TRIGGER_LABEL[x]), e.notes].filter(Boolean).join(", "),
                })),
                ...d.fluids.filter((f) => localDate(f.occurred_at, d.tz) === day).map((f) => ({
                  at: f.occurred_at,
                  intake: `${DRINK_META[f.drink].label} ${f.volume_ml} ml`,
                  output: "",
                  urgency: "",
                  activity: "",
                })),
              ].sort((a, b) => a.at.localeCompare(b.at));
              return (
                <div key={day} className="mb-4 break-inside-avoid">
                  <p className="mb-1 font-medium">{shortDate(day)}</p>
                  {rows.length ? (
                    <table className="w-full">
                      <thead className="text-xs text-fg-muted">
                        <tr><th className="w-14 text-left font-medium">Time</th><th className="text-left font-medium">Drink</th><th className="text-left font-medium">Bladder</th><th className="w-14 text-left font-medium">Urge</th><th className="text-left font-medium">Activity / notes</th></tr>
                      </thead>
                      <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-1 [&_td]:pr-2 [&_td]:align-top">
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td className="font-mono">{localTime(r.at, d.tz)}</td><td>{r.intake}</td><td>{r.output}</td><td>{r.urgency}</td><td>{r.activity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-fg-muted">No entries.</p>
                  )}
                </div>
              );
            })}
          </section>
          <p className="text-xs text-fg-muted">Self-recorded diary from the Hearth app. Urgency: 1 = no urgency, 5 = could not wait.</p>
        </article>
      )}
      <Card className="print:hidden !py-3 text-xs text-fg-muted">
        Tip: use <strong>Print / Save PDF</strong> and choose &quot;Save as PDF&quot; to email it or bring it to your appointment. Doctors usually ask for a 3-day diary.
      </Card>
    </div>
  );
}
