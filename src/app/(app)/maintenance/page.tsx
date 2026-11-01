import { getSession } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { MaintenanceLog, MaintenanceTask } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { daysUntil } from "@/modules/pantry/match";
import { TaskForm } from "./task-form";
import { addTemplate, deleteTask, markDone } from "./actions";

export const metadata = { title: "Home maintenance" };

const TEMPLATES: [string, string, number][] = [
  ["Clean AC filters", "appliance", 90],
  ["RO purifier service", "appliance", 180],
  ["RO filter / membrane change", "appliance", 365],
  ["Kitchen chimney cleaning", "appliance", 90],
  ["Water tank cleaning", "home", 180],
  ["Pest control", "home", 90],
  ["Car service", "vehicle", 365],
  ["Vehicle insurance renewal", "insurance", 365],
  ["PUC certificate", "vehicle", 180],
  ["Smoke detector batteries", "home", 365],
  ["Inverter battery water", "appliance", 60],
  ["Deep clean sofa & mattress", "home", 180],
];

export default async function MaintenancePage() {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const [{ data: t }, { data: l }] = await Promise.all([
    session.supabase.from("maintenance_tasks").select("*").eq("household_id", session.household.id).order("next_due_on", { ascending: true, nullsFirst: false }),
    session.supabase.from("maintenance_log").select("*").eq("household_id", session.household.id).order("done_on", { ascending: false }).limit(30),
  ]);
  const tasks = (t ?? []) as MaintenanceTask[];
  const log = (l ?? []) as MaintenanceLog[];
  const names = Object.fromEntries(session.members.map((m) => [m.user_id, m.display_name]));
  const existing = new Set(tasks.map((x) => x.title.toLowerCase()));
  const templates = TEMPLATES.filter(([title]) => !existing.has(title.toLowerCase()));

  return (
    <div className="space-y-4">
      {templates.length ? (
        <Card>
          <p className="mb-2 text-sm font-medium">Quick add common tasks</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map(([title, cat, days]) => (
              <form key={title} action={addTemplate.bind(null, title, cat, days)}>
                <button className="rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-2">+ {title} <span className="text-fg-muted">· {days}d</span></button>
              </form>
            ))}
          </div>
        </Card>
      ) : null}
      <TaskForm />

      {tasks.length === 0 ? (
        <EmptyState title="No tasks yet" />
      ) : (
        <ul className="space-y-2">
          {tasks.map((x) => {
            const d = daysUntil(x.next_due_on, today);
            return (
              <li key={x.id}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{x.title}</p>
                      <p className="text-xs text-fg-muted">
                        {x.interval_days ? `every ${x.interval_days} days` : "one-off"}
                        {x.last_done_on ? ` · last done ${formatDate(x.last_done_on)}` : ""}
                        {x.vendor ? ` · ${x.vendor}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {d !== null ? (
                        <Badge tone={d < 0 ? "danger" : d <= x.remind_days_before ? "warn" : "neutral"}>
                          {d < 0 ? `overdue ${-d}d` : d === 0 ? "due today" : `due in ${d}d`}
                        </Badge>
                      ) : null}
                      <form action={markDone.bind(null, x.id)} className="flex items-center gap-1">
                        <input name="cost" type="number" min={0} placeholder="₹ cost" aria-label="Cost" className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-sm" />
                        <button className={buttonClass("primary", "sm")}>Done</button>
                      </form>
                      <form action={deleteTask.bind(null, x.id)}>
                        <button className="px-1 text-xs text-fg-muted hover:text-danger" aria-label={`Delete ${x.title}`}>✕</button>
                      </form>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {log.length ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">History</h2>
          <ul className="divide-y divide-border text-sm">
            {log.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 py-1.5">
                <span>{tasks.find((x) => x.id === e.task_id)?.title ?? "Task"}{e.cost ? ` · ₹${Number(e.cost).toLocaleString("en-IN")}` : ""}</span>
                <span className="text-fg-muted">{formatDate(e.done_on)}{e.done_by ? ` · ${names[e.done_by] ?? ""}` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
