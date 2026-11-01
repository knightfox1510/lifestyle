import { getSession } from "@/lib/session";
import { addDays, localDate, localTime, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card, EmptyState } from "@/components/ui";
import { LineChart } from "@/components/charts";
import type { BodyMetric } from "@/lib/types";
import { VitalsForm } from "../forms";
import { deleteBodyMetric } from "../actions";

export const metadata = { title: "Vitals" };

export default async function VitalsPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const canWrite = session.accessTo("body_recomp", ownerId) === "write";
  const { data } = await session.supabase
    .from("body_metrics")
    .select("*")
    .eq("owner_id", ownerId)
    .gte("measured_at", startOfLocalDayIso(addDays(todayIn(tz), -365)))
    .or("bp_systolic.not.is.null,resting_hr.not.is.null,blood_glucose_mgdl.not.is.null")
    .order("measured_at");
  const rows = (data ?? []) as BodyMetric[];
  const pts = (k: keyof BodyMetric, unit: string) =>
    rows.filter((r) => r[k] !== null).map((r) => ({ date: r.measured_at, value: Number(r[k]), label: shortDate(localDate(r.measured_at, tz)), tooltip: `${shortDate(localDate(r.measured_at, tz))} ${localTime(r.measured_at, tz)}: ${r[k]}${unit}` }));
  const fasting = rows.filter((r) => r.blood_glucose_mgdl !== null && r.glucose_context === "fasting");

  return (
    <div className="space-y-4">
      {canWrite ? <VitalsForm ownerId={ownerId} /> : null}
      {rows.length === 0 ? (
        <EmptyState title="No vitals yet">Log blood pressure, resting heart rate or blood sugar from a home device.</EmptyState>
      ) : (
        <>
          {pts("bp_systolic", "").length ? (
            <Card>
              <LineChart title="Blood pressure (systolic)" subtitle="Typical healthy range under 120/80" points={pts("bp_systolic", " mmHg")} band={{ low: 90, high: 120 }} />
            </Card>
          ) : null}
          {fasting.length ? (
            <Card>
              <LineChart
                title="Fasting blood sugar"
                points={fasting.map((r) => ({ date: r.measured_at, value: Number(r.blood_glucose_mgdl), label: shortDate(localDate(r.measured_at, tz)), tooltip: `${shortDate(localDate(r.measured_at, tz))}: ${r.blood_glucose_mgdl} mg/dL` }))}
                band={{ low: 70, high: 99 }}
              />
            </Card>
          ) : null}
          {pts("resting_hr", "").length ? (
            <Card>
              <LineChart title="Resting heart rate" points={pts("resting_hr", " bpm")} />
            </Card>
          ) : null}
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Readings</h2>
            <ul className="divide-y divide-border text-sm">
              {[...rows].reverse().slice(0, 40).map((r) => (
                <li key={r.id} className="flex justify-between gap-2 py-1.5">
                  <span>
                    {shortDate(localDate(r.measured_at, tz))} {localTime(r.measured_at, tz)} ·{" "}
                    {[
                      r.bp_systolic ? `BP ${r.bp_systolic}/${r.bp_diastolic}` : null,
                      r.resting_hr ? `HR ${r.resting_hr}` : null,
                      r.blood_glucose_mgdl ? `Glucose ${r.blood_glucose_mgdl} (${(r.glucose_context ?? "random").replace("_", " ")})` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                  {ownerId === session.userId ? (
                    <form action={deleteBodyMetric.bind(null, r.id)}>
                      <button className="text-xs text-fg-muted hover:text-danger" aria-label="Delete reading">✕</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
