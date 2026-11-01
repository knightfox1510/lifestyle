import { getSession } from "@/lib/session";
import { addDays, lastNDays, localTime, shortDate, todayIn } from "@/lib/dates";
import { Card, EmptyState } from "@/components/ui";
import type { Medicine, MedicineDose } from "@/lib/types";
import { adherence, slotsForDay } from "@/modules/medicines/logic";

export const metadata = { title: "Medicine history" };

export default async function MedicineHistoryPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const from = addDays(today, -29);

  const [{ data: medData }, { data: doseData }] = await Promise.all([
    session.supabase.from("medicines").select("*").eq("owner_id", ownerId).order("name"),
    session.supabase.from("medicine_doses").select("*").eq("owner_id", ownerId).gte("scheduled_date", from).order("taken_at", { ascending: false }),
  ]);
  const meds = (medData ?? []) as Medicine[];
  const doses = (doseData ?? []) as MedicineDose[];
  if (!meds.length) return <EmptyState title="No medicines yet" />;

  // Exclude today from adherence: it isn't over yet.
  const past7 = lastNDays(addDays(today, -1), 7);
  const past30 = lastNDays(addDays(today, -1), 30);
  const days14 = lastNDays(today, 14);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Last 7 days", adherence(meds, doses, past7)],
          ["Last 30 days", adherence(meds, doses, past30)],
        ].map(([label, a]) => {
          const v = a as ReturnType<typeof adherence>;
          return (
            <Card key={label as string} className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label as string}</p>
              <p className="mt-1 text-3xl font-semibold">{v.pct === null ? "–" : `${v.pct}%`}</p>
              <p className="text-xs text-fg-muted">
                {v.taken} of {v.scheduled} scheduled doses taken
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 font-semibold">Last 14 days</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-xs text-fg-muted">
              <th className="py-1 pr-2 text-left font-medium">Medicine</th>
              {days14.map((d) => (
                <th key={d} className="px-0.5 font-normal">{shortDate(d).split(" ")[0]}</th>
              ))}
              <th className="pl-2 text-right font-medium">30d</th>
            </tr>
          </thead>
          <tbody>
            {meds
              .filter((m) => m.times.length)
              .map((m) => {
                const a = adherence([m], doses, past30);
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-2 pr-2">{m.name}</td>
                    {days14.map((d) => {
                      const slots = slotsForDay([m], doses, d);
                      if (!slots.length) return <td key={d} className="text-center text-fg-muted/40">·</td>;
                      const taken = slots.filter((s) => s.dose?.status === "taken").length;
                      const label = `${shortDate(d)}: ${taken}/${slots.length} taken`;
                      return (
                        <td key={d} className="px-0.5 text-center" title={label}>
                          <span
                            aria-label={label}
                            className={`inline-block size-4 rounded ${taken === slots.length ? "bg-accent" : taken > 0 ? "bg-accent/40" : d === today ? "bg-border" : "bg-danger-soft ring-1 ring-danger/40"}`}
                          />
                        </td>
                      );
                    })}
                    <td className="pl-2 text-right tabular-nums">{a.pct === null ? "–" : `${a.pct}%`}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-fg-muted">Full square = all doses taken · light = some · red outline = missed.</p>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Dose log</h2>
        <ul className="divide-y divide-border text-sm">
          {doses.slice(0, 60).map((d) => {
            const m = meds.find((x) => x.id === d.medicine_id);
            return (
              <li key={d.id} className="flex justify-between gap-2 py-1.5">
                <span>
                  {d.status === "taken" ? "✓" : "–"} {m?.name ?? "Medicine"} {d.scheduled_time ? <span className="text-fg-muted">({d.scheduled_time} dose)</span> : <span className="text-fg-muted">(as needed)</span>}
                </span>
                <span className="text-fg-muted">
                  {shortDate(d.scheduled_date)} {d.status === "taken" ? localTime(d.taken_at, tz) : "skipped"}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
