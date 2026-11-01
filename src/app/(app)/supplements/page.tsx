import { getSession } from "@/lib/session";
import { lastNDays, addDays, shortDate, todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { Supplement, SupplementLog } from "@/lib/types";
import { TIMING_LABEL } from "@/modules/supplements/meta";
import { SupplementChecklist } from "./checklist";
import { AddSupplementForm } from "./add-form";
import { deleteSupplement, setSupplementActive, setSupplementAi } from "./actions";

export const metadata = { title: "Supplements" };

export default async function SupplementsPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("supplements", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  const today = todayIn(session.profile.timezone);
  const days = lastNDays(today, 14);

  const [{ data: supData }, { data: logData }] = await Promise.all([
    session.supabase.from("supplements").select("*").eq("owner_id", ownerId).order("sort"),
    session.supabase.from("supplement_logs").select("*").eq("owner_id", ownerId).gte("log_date", addDays(today, -29)),
  ]);
  const all = (supData ?? []) as Supplement[];
  const active = all.filter((s) => s.active);
  const logs = (logData ?? []) as SupplementLog[];
  const takenToday = logs.filter((l) => l.log_date === today).map((l) => l.supplement_id);
  const has = (id: string, d: string) => logs.some((l) => l.supplement_id === id && l.log_date === d);
  const pct30 = (id: string) => {
    const n = lastNDays(addDays(today, -1), 30).filter((d) => has(id, d)).length;
    return Math.round((n / 30) * 100);
  };

  return (
    <div className="space-y-4">
      {active.length === 0 ? (
        <EmptyState title="Your stack is empty">Add supplements like Whey, Creatine, Magnesium Glycinate, D3+K2 or Melatonin.</EmptyState>
      ) : (
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Today</h2>
            <span className="text-sm text-fg-muted">
              {takenToday.filter((id) => active.some((s) => s.id === id)).length}/{active.length}
            </span>
          </div>
          <SupplementChecklist supplements={active} takenIds={takenToday} ownerId={ownerId} date={today} canWrite={canWrite} />
        </Card>
      )}

      {canWrite ? <AddSupplementForm ownerId={ownerId} /> : null}

      {all.length ? (
        <Card className="overflow-x-auto">
          <h2 className="mb-3 font-semibold">Stack & last 14 days</h2>
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="text-xs text-fg-muted">
                <th className="py-1 pr-2 text-left font-medium">Supplement</th>
                {days.map((d) => (
                  <th key={d} className="px-0.5 font-normal">{shortDate(d).split(" ")[0]}</th>
                ))}
                <th className="pl-2 text-right font-medium">30d</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {all.map((s) => (
                <tr key={s.id} className={`border-t border-border ${s.active ? "" : "opacity-60"}`}>
                  <td className="py-2 pr-2">
                    <span className="font-medium">{s.name}</span>
                    <span className="block text-xs text-fg-muted">
                      {[s.dose, TIMING_LABEL[s.timing], s.stock_count !== null ? `${s.stock_count} left` : null].filter(Boolean).join(" · ")}
                    </span>
                    {!s.include_in_ai ? <Badge>hidden from AI</Badge> : null}
                  </td>
                  {days.map((d) => (
                    <td key={d} className="px-0.5 text-center" title={`${shortDate(d)}: ${has(s.id, d) ? "taken" : "not taken"}`}>
                      <span className={`inline-block size-4 rounded ${has(s.id, d) ? "bg-accent" : "bg-surface-2 ring-1 ring-border"}`} />
                    </td>
                  ))}
                  <td className="pl-2 text-right tabular-nums">{pct30(s.id)}%</td>
                  <td className="pl-2">
                    {canWrite ? (
                      <div className="flex justify-end gap-1">
                        <form action={setSupplementActive.bind(null, s.id, ownerId, !s.active)}>
                          <button className={buttonClass("ghost", "sm")}>{s.active ? "Pause" : "Resume"}</button>
                        </form>
                        <form action={setSupplementAi.bind(null, s.id, ownerId, !s.include_in_ai)}>
                          <button className={buttonClass("ghost", "sm")}>{s.include_in_ai ? "Hide from AI" : "Use in AI"}</button>
                        </form>
                        {isOwner ? (
                          <form action={deleteSupplement.bind(null, s.id)}>
                            <button className={buttonClass("danger", "sm")} aria-label={`Delete ${s.name}`}>✕</button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
