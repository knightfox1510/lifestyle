import { getSession } from "@/lib/session";
import { addDays, dayOfWeek, lastNDays, shortDay, todayIn } from "@/lib/dates";
import { streak } from "@/lib/streak";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { Habit, HabitLog } from "@/lib/types";
import { HabitGrid } from "./habit-grid";
import { AddHabitForm } from "./add-habit-form";
import { archiveHabit, deleteHabit, updateHabit } from "./actions";
import { EditRecord } from "@/components/edit-record";

export const metadata = { title: "Habits" };

export default async function HabitsPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const today = todayIn(session.profile.timezone);
  const canWrite = session.accessTo("habits", ownerId) === "write";
  const [{ data: h }, { data: l }] = await Promise.all([
    session.supabase.from("habits").select("*").eq("owner_id", ownerId).order("sort"),
    session.supabase.from("habit_logs").select("*").eq("owner_id", ownerId).gte("log_date", addDays(today, -90)),
  ]);
  const habits = (h ?? []) as Habit[];
  const logs = (l ?? []) as HabitLog[];
  const active = habits.filter((x) => x.active);
  const days = lastNDays(today, 7);
  // Week = Monday..today
  const weekStart = addDays(today, -((dayOfWeek(today) + 6) % 7));

  return (
    <div className="space-y-4">
      {active.length ? (
        <Card className="overflow-x-auto">
          <HabitGrid
            habits={active}
            done={logs.map((x) => `${x.habit_id}|${x.log_date}`)}
            days={days}
            dayLabels={days.map((d) => (d === today ? "Today" : shortDay(d)))}
            ownerId={ownerId}
            canWrite={canWrite}
          />
        </Card>
      ) : (
        <EmptyState title="No habits yet">Try “10-minute walk”, “No caffeine after 2 pm” or “Drink 2 L water”.</EmptyState>
      )}

      {canWrite ? <AddHabitForm ownerId={ownerId} /> : null}

      {habits.length ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Progress</h2>
          <ul className="divide-y divide-border">
            {habits.map((x) => {
              const dates = new Set(logs.filter((g) => g.habit_id === x.id).map((g) => g.log_date));
              const thisWeek = [...dates].filter((d) => d >= weekStart && d <= today).length;
              return (
                <li key={x.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${x.active ? "" : "opacity-60"}`}>
                  <div>
                    <p className="text-sm font-medium"><span aria-hidden>{x.icon}</span> {x.name}</p>
                    <p className="text-xs text-fg-muted">
                      This week {thisWeek}/{x.target_per_week} · streak {streak(dates, today)} days · last 30 days {lastNDays(today, 30).filter((d) => dates.has(d)).length}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {thisWeek >= x.target_per_week ? <Badge tone="accent">week target met</Badge> : null}
                    {canWrite ? (
                      <EditRecord
                        fields={[
                          { name: "icon", label: "Icon (emoji)", type: "text", maxLength: 8 },
                          { name: "name", label: "Habit", type: "text", maxLength: 80 },
                          { name: "target_per_week", label: "Days per week", type: "number", min: 1, max: 7, step: 1 },
                        ]}
                        values={{ icon: x.icon, name: x.name, target_per_week: x.target_per_week }}
                        onSave={updateHabit.bind(null, x.id, ownerId)}
                      />
                    ) : null}
                    {canWrite ? (
                      <form action={archiveHabit.bind(null, x.id, ownerId, !x.active)}>
                        <button className={buttonClass("ghost", "sm")}>{x.active ? "Archive" : "Restore"}</button>
                      </form>
                    ) : null}
                    {ownerId === session.userId ? (
                      <form action={deleteHabit.bind(null, x.id)}>
                        <button className={buttonClass("danger", "sm")} aria-label={`Delete ${x.name}`}>✕</button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
