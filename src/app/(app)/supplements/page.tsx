import { getSession } from "@/lib/session";
import { lastNDays, addDays, localDate, shortDate, todayIn } from "@/lib/dates";
import { describeRepeat, isDueOn, nextDueOn } from "@/modules/schedule";
import { supplementRepeat } from "@/modules/supplements/meta";
import { SupplementScheduleEdit } from "./schedule-edit";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { Supplement, SupplementLog } from "@/lib/types";
import { TIMING_LABEL } from "@/modules/supplements/meta";
import { SupplementChecklist } from "./checklist";
import { AddSupplementForm } from "./add-form";
import { deleteSupplement, setSupplementActive, setSupplementAi, updateSupplement } from "./actions";
import { SupplementDayCell } from "./day-cell";
import { EditRecord } from "@/components/edit-record";
import { SUPPLEMENT_TIMINGS } from "@/lib/types";
import { SupplementNutrientsEditor } from "./nutrients-editor";
import { NUTRIENT_META, formatNutrient, type NutrientKey } from "@/modules/nutrition/nutrients";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Supplements" };

export default async function SupplementsPage() {
  const session = await getSession();
  const t = await getT(session);
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("supplements", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  const today = todayIn(session.profile.timezone);
  const days = lastNDays(today, 14);

  const [{ data: supData }, { data: logData }] = await Promise.all([
    session.supabase.from("supplements").select("*").eq("owner_id", ownerId).order("sort"),
    session.supabase.from("supplement_logs").select("*").eq("owner_id", ownerId).gte("log_date", addDays(today, -29)),
  ]);
  const all = (supData ?? []) as (Supplement & { created_at: string })[];
  const tz = session.profile.timezone;
  const repeatOf = (x: Supplement & { created_at: string }) => supplementRepeat(x, (iso) => localDate(iso, tz));
  const dueOn = (x: Supplement & { created_at: string }, d: string) => isDueOn(repeatOf(x), d);
  const activeAll = all.filter((s) => s.active);
  // Today's checklist is only what's due today; the rest say when they're next due.
  const active = activeAll.filter((s) => dueOn(s, today));
  const notToday = activeAll.filter((s) => !dueOn(s, today));
  const logs = (logData ?? []) as SupplementLog[];
  const takenToday = logs.filter((l) => l.log_date === today).map((l) => l.supplement_id);
  const has = (id: string, d: string) => logs.some((l) => l.supplement_id === id && l.log_date === d);
  // Taken on how many of the days it was due (last 30 days, not counting today).
  const pct30 = (id: string) => {
    const x = all.find((s) => s.id === id)!;
    const due = lastNDays(addDays(today, -1), 30).filter((d) => dueOn(x, d));
    return due.length ? Math.round((due.filter((d) => has(id, d)).length / due.length) * 100) : 0;
  };

  return (
    <div className="space-y-4">
      {activeAll.length === 0 ? (
        <EmptyState title="Your stack is empty">Add supplements like Whey, Creatine, Magnesium Glycinate, D3+K2 or Melatonin.</EmptyState>
      ) : (
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Today</h2>
            <span className="text-sm text-fg-muted">
              {takenToday.filter((id) => active.some((s) => s.id === id)).length}/{active.length}
            </span>
          </div>
          {active.length ? (
            <SupplementChecklist supplements={active} takenIds={takenToday} ownerId={ownerId} date={today} canWrite={canWrite} />
          ) : (
            <p className="text-sm text-fg-muted">Nothing due today.</p>
          )}
          {notToday.length ? (
            <p className="mt-3 text-xs text-fg-muted">
              Not today: {notToday.map((x) => `${x.name} (next ${shortDate(nextDueOn(repeatOf(x), today) ?? today)})`).join(", ")}
            </p>
          ) : null}
        </Card>
      )}

      {canWrite ? <AddSupplementForm ownerId={ownerId} today={today} /> : null}

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
                      {[s.dose, TIMING_LABEL[s.timing], describeRepeat(repeatOf(s)), s.stock_count !== null ? `${s.stock_count} left` : null].filter(Boolean).join(" · ")}
                    </span>
                    {!s.include_in_ai ? <Badge>hidden from AI</Badge> : null}
                    {canWrite ? (
                      <SupplementScheduleEdit id={s.id} ownerId={ownerId} daysOfWeek={s.days_of_week ?? null} every={s.repeat_every_days ?? null} start={repeatOf(s).start} today={today} />
                    ) : null}
                    {canWrite ? (
                      <EditRecord
                        fields={[
                          { name: "name", label: "Name", type: "text", maxLength: 120 },
                          { name: "dose", label: "Dose", type: "text", maxLength: 60 },
                          { name: "timing", label: "When", type: "select", options: SUPPLEMENT_TIMINGS.map((x) => ({ value: x, label: TIMING_LABEL[x] })) },
                          { name: "stock_count", label: "In stock", type: "number", min: 0, step: 1 },
                        ]}
                        values={{ name: s.name, dose: s.dose, timing: s.timing, stock_count: s.stock_count }}
                        onSave={updateSupplement.bind(null, s.id, ownerId)}
                      />
                    ) : null}
                  </td>
                  {days.map((d) => (
                    <td key={d} className="px-0.5 text-center" title={`${shortDate(d)}: ${has(s.id, d) ? "taken" : "not taken"}`}>
                      {!has(s.id, d) && !dueOn(s, d) ? (
                        <span className="inline-block size-5 text-center text-xs leading-5 text-fg-muted" title={`${shortDate(d)}: not due`}>·</span>
                      ) : canWrite ? (
                        <SupplementDayCell supplementId={s.id} ownerId={ownerId} date={d} taken={has(s.id, d)} label={`${s.name}, ${shortDate(d)}`} />
                      ) : (
                        <span className={`inline-block size-4 rounded ${has(s.id, d) ? "bg-accent" : "bg-surface-2 ring-1 ring-border"}`} />
                      )}
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

      {all.length ? (
        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">{t("What's in each dose")}</h2>
            <p className="text-sm text-fg-muted">{t("Counted in your daily vitamins & minerals (and protein) on the days you tick it.")}</p>
          </div>
          <ul className="divide-y divide-border">
            {all.map((s) => {
              const n = Object.entries(s.nutrients ?? {}).filter(([, v]) => Number(v) > 0);
              return (
                <li key={s.id} className="py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="font-medium">{s.name}</span>
                        <span className="block truncate text-xs text-fg-muted">
                          {n.length
                            ? n.map(([k, v]) => `${t(NUTRIENT_META[k as NutrientKey]?.label ?? k)} ${formatNutrient(k as NutrientKey, Number(v))}`).join(" · ")
                            : t("Nutrients not added yet")}
                        </span>
                      </span>
                      {canWrite ? <span className={buttonClass("soft", "sm")}>{n.length ? t("Edit") : t("Add nutrients")}</span> : null}
                    </summary>
                    {canWrite ? (
                      <div className="mt-3">
                        <SupplementNutrientsEditor id={s.id} ownerId={ownerId} name={s.name} initial={s.nutrients} initialServing={s.serving_label} />
                      </div>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
