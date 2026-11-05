import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { shortDate } from "@/lib/dates";
import { KIND_META } from "@/modules/fitness/meta";
import { goalDays } from "@/modules/fitness/goals";
import { loadRecap } from "@/lib/us-recap";

export const metadata = { title: "Our week" };

/** "Our week": both of you side by side (only what you share), the joint goal, what you watched, and what's coming up. */
export default async function UsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  const { week: w } = await searchParams;
  const r = await loadRecap(session, w === "last" ? "last" : w === "this" ? "this" : undefined);
  const range = `${shortDate(r.week.start)} – ${shortDate(r.week.end)}`;
  const solo = r.people.length < 2;

  return (
    <div className="space-y-4">
      <PageHeader title={r.week.last ? "Last week together" : "Our week so far"} subtitle={range} />
      <div className="flex gap-1.5 text-sm">
        <Link href="/us?week=this" className={cx("rounded-full border px-3 py-1", !r.week.last ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>This week</Link>
        <Link href="/us?week=last" className={cx("rounded-full border px-3 py-1", r.week.last ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>Last week</Link>
      </div>

      {r.highlights.length ? (
        <Card className="space-y-1.5 bg-accent-soft/40">
          {r.highlights.map((h) => <p key={h} className="text-[15px]">{h}</p>)}
        </Card>
      ) : (
        <EmptyState title="A quiet week so far">Close your days, log workouts and tick off shows, and the highlights show up here.</EmptyState>
      )}

      <div className={cx("grid gap-3", !solo && "sm:grid-cols-2")}>
        {r.people.map((p) => (
          <Card key={p.id} className="space-y-2 !p-4">
            <p className="font-semibold">{p.name}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-fg-muted">Days closed</dt><dd className="text-lg font-semibold tabular-nums">{p.closedDays ?? "—"}<span className="text-xs font-normal text-fg-muted"> / {r.week.days}</span></dd></div>
              <div><dt className="text-xs text-fg-muted">Workouts</dt><dd className="text-lg font-semibold tabular-nums">{p.workouts ? p.workouts.sessions : "—"}{p.workouts?.minutes ? <span className="text-xs font-normal text-fg-muted"> · {p.workouts.minutes} min</span> : null}</dd></div>
              {p.steps != null ? <div><dt className="text-xs text-fg-muted">Steps</dt><dd className="text-lg font-semibold tabular-nums">{p.steps.toLocaleString("en-IN")}</dd></div> : null}
              <div><dt className="text-xs text-fg-muted">Cheers sent</dt><dd className="text-lg font-semibold tabular-nums">{p.cheersSent}</dd></div>
            </dl>
            {p.goals?.length && p.logs ? (
              <ul className="space-y-0.5 text-sm">
                {p.goals.map((g) => {
                  const n = goalDays(g, p.logs!, r.week.start, r.week.end).size;
                  return (
                    <li key={g.kind} className={cx(n >= g.times_per_week ? "text-accent" : "text-fg-muted")}>
                      {g.kind === "any" ? "💪 Any workout" : `${KIND_META[g.kind].icon} ${KIND_META[g.kind].label}`} {n}/{g.times_per_week}{n >= g.times_per_week ? " ✓" : ""}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {p.closedDays == null && p.workouts == null ? <p className="text-xs text-fg-muted">{p.name} doesn&apos;t share their day or workouts with you.</p> : null}
          </Card>
        ))}
      </div>

      {!solo && r.bothClosed != null ? (
        <Card className="!p-4">
          <p className="text-sm font-semibold">Joint goal: both close 5 days</p>
          <div className="mt-2 flex gap-1" aria-label={`${r.bothClosed} of 5`}>
            {Array.from({ length: 5 }, (_, i) => <span key={i} className={cx("h-2.5 flex-1 rounded-full", i < r.bothClosed! ? "bg-accent" : "bg-surface-2")} />)}
          </div>
        </Card>
      ) : null}

      {r.watched.together.length || r.watched.finished.length ? (
        <Card className="space-y-1 !p-4 text-sm">
          <p className="font-semibold">🎬 Watching</p>
          {r.watched.together.map((x) => <p key={x.title}>{x.title}{x.where ? <span className="text-fg-muted"> · {x.where}</span> : null}</p>)}
          {r.watched.finished.length ? <p className="text-fg-muted">Finished: {r.watched.finished.join(", ")}</p> : null}
          <Link href="/watchlist" className="text-xs text-accent">Open the watchlist →</Link>
        </Card>
      ) : null}

      {r.upcoming.length ? (
        <Card className="space-y-1 !p-4 text-sm">
          <p className="font-semibold">🎁 Coming up</p>
          {r.upcoming.map((o) => <p key={o.title + o.on}>{o.title} <span className="text-fg-muted">· {o.on === r.today ? "today" : shortDate(o.on)}</span></p>)}
        </Card>
      ) : null}

      <p className="text-xs text-fg-muted">Only what each of you shares is shown. The private log never appears here.</p>
    </div>
  );
}
