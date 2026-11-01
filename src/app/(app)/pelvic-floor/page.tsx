import { getSession } from "@/lib/session";
import { streak } from "@/lib/streak";
import { addDays, lastNDays, localDate, localTime, shortDate, shortDay, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card } from "@/components/ui";
import type { PelvicFloorSession } from "@/lib/types";
import { KegelTrainer } from "./trainer";
import { deleteKegelSession } from "./actions";

export const metadata = { title: "Pelvic floor trainer" };

export default async function PelvicFloorPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const canWrite = session.accessTo("pelvic_floor", ownerId) === "write";
  const { data } = await session.supabase
    .from("pelvic_floor_sessions")
    .select("*")
    .eq("owner_id", ownerId)
    .gte("performed_at", startOfLocalDayIso(addDays(today, -60)))
    .order("performed_at", { ascending: false });
  const sessions = (data ?? []) as PelvicFloorSession[];
  const completed = sessions.filter((s) => s.completed);
  const byDay = new Map<string, number>();
  for (const s of completed) byDay.set(localDate(s.performed_at, tz), (byDay.get(localDate(s.performed_at, tz)) ?? 0) + 1);
  const week = lastNDays(today, 7);
  const days28 = lastNDays(today, 28);
  const thisWeek = week.reduce((a, d) => a + (byDay.get(d) ?? 0), 0);

  return (
    <div className="space-y-4">
      {canWrite ? <KegelTrainer ownerId={ownerId} /> : null}

      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Today</p>
          <p className="text-2xl font-semibold">{byDay.get(today) ?? 0}<span className="text-sm font-normal text-fg-muted"> / 3</span></p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">This week</p>
          <p className="text-2xl font-semibold">{thisWeek}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Streak</p>
          <p className="text-2xl font-semibold">{streak(new Set(byDay.keys()), today)}<span className="text-sm font-normal text-fg-muted"> days</span></p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Last 4 weeks</h2>
        <div className="grid grid-cols-7 gap-1.5">
          {days28.slice(0, 7).map((d) => (
            <span key={`h-${d}`} className="text-center text-[11px] text-fg-muted">{shortDay(d)}</span>
          ))}
          {days28.map((d) => {
            const n = byDay.get(d) ?? 0;
            return (
              <span
                key={d}
                title={`${shortDate(d)}: ${n} session${n === 1 ? "" : "s"}`}
                className={`flex aspect-square items-center justify-center rounded-lg text-xs ${n >= 3 ? "bg-accent text-accent-fg" : n > 0 ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-muted"} ${d === today ? "ring-2 ring-accent/50" : ""}`}
              >
                {n || ""}
              </span>
            );
          })}
        </div>
      </Card>

      {sessions.length ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Recent sessions</h2>
          <ul className="divide-y divide-border text-sm">
            {sessions.slice(0, 15).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  {s.completed ? "✓" : "◐"} {s.sets}×{s.reps} · {s.hold_seconds}s hold{s.quick_flicks ? ` · ${s.quick_flicks} flicks` : ""}
                </span>
                <span className="flex items-center gap-2 text-fg-muted">
                  {shortDate(localDate(s.performed_at, tz))} {localTime(s.performed_at, tz)}
                  {ownerId === session.userId ? (
                    <form action={deleteKegelSession.bind(null, s.id)}>
                      <button className="text-xs hover:text-danger" aria-label="Delete session">✕</button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
