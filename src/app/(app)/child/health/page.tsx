import Link from "next/link";
import { getSession } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, buttonClass, cx } from "@/components/ui";
import { LineChart } from "@/components/charts";
import type { Dependent, GrowthRecord, Vaccination } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { GrowthForm, VaccineForm } from "../client";
import { deleteVaccine, setVaccineGiven } from "../actions";

export const metadata = { title: "Vaccinations & growth" };

export default async function ChildHealthPage({ searchParams }: PageProps<"/child/health">) {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const { c } = await searchParams;
  const { data: deps } = await session.supabase.from("dependents").select("*").eq("household_id", session.household.id).order("created_at");
  const dependents = (deps ?? []) as Dependent[];
  if (!dependents.length) return <EmptyState title="Add a child first"><Link href="/child" className="text-accent underline">Go to Today</Link></EmptyState>;
  const dep = dependents.find((d) => d.id === c) ?? dependents[0];
  const [{ data: v }, { data: g }] = await Promise.all([
    session.supabase.from("vaccinations").select("*").eq("dependent_id", dep.id).order("due_on", { ascending: true, nullsFirst: false }),
    session.supabase.from("growth_records").select("*").eq("dependent_id", dep.id).order("measured_on"),
  ]);
  const vaccines = (v ?? []) as Vaccination[];
  const growth = (g ?? []) as GrowthRecord[];
  const pending = vaccines.filter((x) => !x.given_on);
  const given = vaccines.filter((x) => x.given_on);

  return (
    <div className="space-y-4">
      {dependents.length > 1 ? (
        <div className="flex gap-1.5">
          {dependents.map((d) => (
            <Link key={d.id} href={`/child/health?c=${d.id}`} className={cx("rounded-full border px-3 py-1 text-sm", d.id === dep.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>{d.name}</Link>
          ))}
        </div>
      ) : null}

      <Card className="space-y-3">
        <div>
          <h2 className="font-semibold">Vaccinations · {dep.name}</h2>
          <p className="text-xs text-fg-muted">Based on the IAP schedule. Your paediatrician&apos;s plan always wins; edit freely.</p>
        </div>
        {pending.length ? (
          <ul className="divide-y divide-border">
            {pending.map((x) => {
              const overdue = x.due_on && x.due_on < today;
              return (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {x.vaccine} {x.due_on ? <Badge tone={overdue ? "danger" : "neutral"}>{overdue ? "overdue · " : "due "}{formatDate(x.due_on)}</Badge> : null}
                  </span>
                  <span className="flex items-center gap-1">
                    <form action={setVaccineGiven.bind(null, x.id, true)} className="flex items-center gap-1">
                      <input type="date" name="given_on" defaultValue={today} max={today} className="h-8 rounded-lg border border-border bg-surface px-2 text-sm" aria-label="Date given" />
                      <button className={buttonClass("secondary", "sm")}>Given</button>
                    </form>
                    <form action={deleteVaccine.bind(null, x.id)}>
                      <button className="px-1 text-xs text-fg-muted hover:text-danger" aria-label={`Remove ${x.vaccine}`}>✕</button>
                    </form>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">Nothing pending.</p>
        )}
        <VaccineForm dependentId={dep.id} />
        {given.length ? (
          <details>
            <summary className="cursor-pointer text-sm text-fg-muted">Given ({given.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {given.map((x) => (
                <li key={x.id} className="flex justify-between gap-2">
                  <span>✓ {x.vaccine}</span>
                  <span className="flex items-center gap-2 text-fg-muted">
                    {formatDate(x.given_on)}
                    <form action={setVaccineGiven.bind(null, x.id, false)}>
                      <button className="text-xs hover:underline">undo</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Growth</h2>
        <GrowthForm dependentId={dep.id} today={today} />
        {growth.filter((x) => x.weight_kg !== null).length ? (
          <LineChart
            title="Weight"
            unit=" kg"
            points={growth.filter((x) => x.weight_kg !== null).map((x) => ({ date: x.measured_on, value: Number(x.weight_kg), label: formatDate(x.measured_on) }))}
            height={150}
          />
        ) : null}
        {growth.length ? (
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-fg-muted">
              <tr><th className="text-left font-medium">Date</th><th className="text-right font-medium">Weight</th><th className="text-right font-medium">Height</th><th className="text-right font-medium">Head</th></tr>
            </thead>
            <tbody>
              {[...growth].reverse().map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="py-1">{formatDate(x.measured_on)}</td>
                  <td className="text-right">{x.weight_kg ?? "–"}</td>
                  <td className="text-right">{x.height_cm ?? "–"}</td>
                  <td className="text-right">{x.head_cm ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <p className="text-xs text-fg-muted">Compare with the growth chart your paediatrician uses (WHO/IAP percentiles).</p>
      </Card>
    </div>
  );
}
