import Link from "next/link";
import { getSession } from "@/lib/session";
import { addDays, localDate, localTime, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Badge, Card, buttonClass, cx } from "@/components/ui";
import type { ChildLog, Dependent, Vaccination } from "@/lib/types";
import { LOG_META, ageLabel, durationLabel } from "@/modules/child/vaccines";
import { AddDependentForm, ChildQuickLog } from "./client";
import { deleteChildLog, endSleep, startSleep, updateChildLog } from "./actions";
import { EditRecord } from "@/components/edit-record";
import { CHILD_LOG_KINDS } from "@/lib/types";
import { isoToLocalInput } from "@/lib/dates";

export const metadata = { title: "Child routine" };

/** Time since an instant, computed outside render for purity. */
function since(iso: string) {
  return durationLabel(Date.now() - new Date(iso).getTime());
}

export default async function ChildPage({ searchParams }: PageProps<"/child">) {
  const session = await getSession();
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const { c } = await searchParams;
  const { data: deps } = await session.supabase.from("dependents").select("*").eq("household_id", session.household.id).order("created_at");
  const dependents = (deps ?? []) as Dependent[];
  if (!dependents.length) {
    return <AddDependentForm first />;
  }
  const dep = dependents.find((d) => d.id === c) ?? dependents[0];
  const names = Object.fromEntries(session.members.map((m) => [m.user_id, m.user_id === session.userId ? "you" : m.display_name]));

  const [{ data: l }, { data: v }] = await Promise.all([
    session.supabase.from("child_logs").select("*").eq("dependent_id", dep.id).gte("started_at", startOfLocalDayIso(addDays(today, -1))).order("started_at", { ascending: false }),
    session.supabase.from("vaccinations").select("*").eq("dependent_id", dep.id).is("given_on", null).lte("due_on", addDays(today, 14)).order("due_on"),
  ]);
  const logs = (l ?? []) as ChildLog[];
  const todayLogs = logs.filter((x) => localDate(x.started_at, tz) === today);
  const openSleep = logs.find((x) => x.kind === "sleep" && !x.ended_at);
  const lastMed = logs.find((x) => x.kind === "medicine");
  const feeds = todayLogs.filter((x) => x.kind === "feed");
  const sleepMs = todayLogs.filter((x) => x.kind === "sleep").reduce((a, x) => a + ((x.ended_at ? new Date(x.ended_at).getTime() : new Date(x.started_at).getTime()) - new Date(x.started_at).getTime()), 0);
  const dueVaccines = (v ?? []) as Vaccination[];

  return (
    <div className="space-y-4">
      {dependents.length > 1 ? (
        <div className="flex gap-1.5">
          {dependents.map((d) => (
            <Link key={d.id} href={`/child?c=${d.id}`} className={cx("rounded-full border px-3 py-1 text-sm", d.id === dep.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
              {d.name}
            </Link>
          ))}
        </div>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{dep.kind === "pet" ? "🐾" : "👶"} {dep.name}</p>
          <p className="text-sm text-fg-muted">{ageLabel(dep.date_of_birth, today)}</p>
        </div>
        {openSleep ? (
          <form action={endSleep.bind(null, openSleep.id)}>
            <button className={buttonClass("primary")}>☀️ Woke up · slept {since(openSleep.started_at)}</button>
          </form>
        ) : (
          <form action={startSleep.bind(null, dep.id)}>
            <button className={buttonClass("secondary")}>😴 Start nap / sleep</button>
          </form>
        )}
      </Card>

      {dueVaccines.length ? (
        <Card className="border-danger/40">
          <p className="text-sm">
            💉 {dueVaccines.map((x) => `${x.vaccine} (${x.due_on! < today ? "overdue" : `due ${x.due_on}`})`).join(", ")} ·{" "}
            <Link href={`/child/health?c=${dep.id}`} className="text-accent underline">Vaccinations</Link>
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Feeds today</p>
          <p className="text-2xl font-semibold">{feeds.length}</p>
          {feeds.some((f) => f.amount_ml) ? <p className="text-xs text-fg-muted">{feeds.reduce((a, f) => a + (f.amount_ml ?? 0), 0)} ml</p> : null}
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Sleep today</p>
          <p className="text-2xl font-semibold">{durationLabel(sleepMs)}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Nappies</p>
          <p className="text-2xl font-semibold">{todayLogs.filter((x) => x.kind === "diaper").length}</p>
        </Card>
      </div>

      <ChildQuickLog
        dependentId={dep.id}
        lastMedicine={lastMed && lastMed.detail ? { detail: lastMed.detail, ago: since(lastMed.started_at), by: names[lastMed.logged_by ?? ""] ?? "someone" } : null}
      />

      <Card>
        <h2 className="mb-2 font-semibold">Today</h2>
        {todayLogs.length === 0 ? (
          <p className="text-sm text-fg-muted">Nothing logged yet today.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {todayLogs.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="mr-2 font-mono text-fg-muted">{localTime(x.started_at, tz)}</span>
                  {LOG_META[x.kind].icon} {LOG_META[x.kind].label}
                  {x.kind === "sleep" ? ` · ${x.ended_at ? durationLabel(new Date(x.ended_at).getTime() - new Date(x.started_at).getTime()) : "sleeping now"}` : ""}
                  {x.amount_ml ? ` · ${x.amount_ml} ml` : ""}
                  {x.value ? ` · ${x.value} °C` : ""}
                  {x.detail ? ` · ${x.detail}` : ""}
                  <span className="text-xs text-fg-muted"> · {names[x.logged_by ?? ""] ?? ""}</span>
                  {x.kind === "temperature" && x.value && Number(x.value) >= 38 ? <> <Badge tone="danger">fever</Badge></> : null}
                </span>
                <span className="flex items-center gap-1">
                  <EditRecord
                    fields={[
                      { name: "kind", label: "What", type: "select", options: CHILD_LOG_KINDS.map((k) => ({ value: k, label: `${LOG_META[k].icon} ${LOG_META[k].label}` })) },
                      { name: "started", label: x.kind === "sleep" ? "Fell asleep" : "Time", type: "datetime-local" },
                      ...(x.kind === "sleep" ? [{ name: "ended", label: "Woke up", type: "datetime-local" as const }] : []),
                      { name: "amount_ml", label: "Amount (ml)", type: "number", min: 0, max: 2000, step: 5 },
                      { name: "value", label: "Temperature (°C)", type: "number", min: 25, max: 45, step: 0.1 },
                      { name: "detail", label: "Details", type: "textarea", maxLength: 300 },
                    ]}
                    values={{ kind: x.kind, started: isoToLocalInput(x.started_at, tz), ended: x.ended_at ? isoToLocalInput(x.ended_at, tz) : null, amount_ml: x.amount_ml, value: x.value, detail: x.detail }}
                    onSave={updateChildLog.bind(null, x.id)}
                  />
                  <form action={deleteChildLog.bind(null, x.id)}>
                    <button className="text-xs text-fg-muted hover:text-danger" aria-label="Delete entry">✕</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddDependentForm first={false} />
    </div>
  );
}
