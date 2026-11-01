import { getSession } from "@/lib/session";
import { addDays, dayOfWeek, shortDate, shortDay, todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, cx } from "@/components/ui";
import { ColumnChart } from "@/components/charts";
import type { FitnessClass, WorkoutLog } from "@/lib/types";
import { KIND_META, classesOn } from "@/modules/fitness/meta";
import { ClassButtons, WorkoutForm } from "./client";
import { deleteWorkout } from "./actions";

export const metadata = { title: "Fitness" };

export default async function FitnessPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const today = todayIn(session.profile.timezone);
  const canWrite = session.accessTo("fitness", ownerId) === "write";
  const monday = addDays(today, -((dayOfWeek(today) + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [{ data: c }, { data: l }] = await Promise.all([
    session.supabase.from("fitness_classes").select("*").eq("owner_id", ownerId),
    session.supabase.from("workout_logs").select("*").eq("owner_id", ownerId).gte("performed_on", addDays(monday, -49)).order("performed_on", { ascending: false }),
  ]);
  const classes = (c ?? []) as FitnessClass[];
  const logs = (l ?? []) as WorkoutLog[];
  const done = logs.filter((x) => x.status === "done");
  const thisWeek = done.filter((x) => x.performed_on >= monday);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(monday, -7 * (7 - i)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Sessions this week</p>
          <p className="text-2xl font-semibold">{thisWeek.length}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Minutes this week</p>
          <p className="text-2xl font-semibold">{thisWeek.reduce((a, x) => a + (x.duration_minutes ?? 0), 0)}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Skipped this week</p>
          <p className="text-2xl font-semibold">{logs.filter((x) => x.status === "skipped" && x.performed_on >= monday).length}</p>
        </Card>
      </div>

      {canWrite ? <WorkoutForm ownerId={ownerId} today={today} /> : null}

      {classes.length === 0 ? (
        <EmptyState title="No classes scheduled">Add your gym or yoga timings under Schedule to get reminders and a weekly plan.</EmptyState>
      ) : null}

      <div className="space-y-2">
        {week.map((d) => {
          const scheduled = classesOn(classes, d);
          const extra = logs.filter((x) => x.performed_on === d && !x.class_id);
          if (!scheduled.length && !extra.length) return null;
          return (
            <Card key={d} className={cx("!p-4", d === today && "ring-2 ring-accent/40")}>
              <p className="mb-2 text-sm font-semibold">{d === today ? "Today" : shortDay(d)} <span className="font-normal text-fg-muted">{shortDate(d)}</span></p>
              <ul className="space-y-2">
                {scheduled.map((cl) => {
                  const log = logs.find((x) => x.class_id === cl.id && x.performed_on === d);
                  return (
                    <li key={cl.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <span className="mr-2 font-mono text-fg-muted">{cl.start_time}</span>
                        {KIND_META[cl.kind].icon} {cl.name}
                        <span className="text-xs text-fg-muted"> · {cl.duration_minutes} min{cl.location ? ` · ${cl.location}` : ""}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {log ? <Badge tone={log.status === "done" ? "accent" : "warn"}>{log.status}</Badge> : null}
                        {canWrite && d <= today ? <ClassButtons classId={cl.id} ownerId={ownerId} date={d} status={log?.status ?? null} /> : null}
                      </span>
                    </li>
                  );
                })}
                {extra.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {KIND_META[x.kind].icon} {x.title}
                      <span className="text-xs text-fg-muted">{x.duration_minutes ? ` · ${x.duration_minutes} min` : ""}{x.intensity ? ` · effort ${x.intensity}/5` : ""}</span>
                    </span>
                    {ownerId === session.userId ? (
                      <form action={deleteWorkout.bind(null, x.id)}>
                        <button className="text-xs text-fg-muted hover:text-danger" aria-label="Delete workout">✕</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {done.length ? (
        <Card>
          <ColumnChart
            title="Workout minutes per week"
            data={weeks.map((w) => {
              const mins = done.filter((x) => x.performed_on >= w && x.performed_on <= addDays(w, 6)).reduce((a, x) => a + (x.duration_minutes ?? 0), 0);
              return { key: w, label: shortDate(w), value: mins, tooltip: `Week of ${shortDate(w)}: ${mins} min` };
            })}
            unit=" min"
            height={120}
          />
        </Card>
      ) : null}
    </div>
  );
}
