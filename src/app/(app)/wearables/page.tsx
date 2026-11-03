import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { addDays, lastNDays, shortDate, todayIn } from "@/lib/dates";
import { Card, EmptyState, buttonClass } from "@/components/ui";
import { ColumnChart, LineChart } from "@/components/charts";
import type { WearableDay } from "@/lib/types";
import { CsvImport, ManualDayForm, TokenCreator } from "./client";
import { HealthConnectSync, type SyncStatus } from "./health-connect";
import { revokeIngestToken } from "./actions";

export const metadata = { title: "Wearable data" };

export default async function WearablesPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const isSelf = ownerId === session.userId;
  const today = todayIn(session.profile.timezone);
  const [{ data }, tokens, h, hc] = await Promise.all([
    session.supabase.from("wearable_daily").select("*").eq("owner_id", ownerId).gte("day", addDays(today, -89)).order("day"),
    isSelf ? session.supabase.from("ingest_tokens").select("id, label, created_at, last_used_at").eq("user_id", session.userId) : Promise.resolve({ data: [] }),
    headers(),
    isSelf ? session.supabase.from("health_connect_syncs").select("last_run_at, last_status, last_message, last_day, days_imported").eq("user_id", session.userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const rows = (data ?? []) as WearableDay[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const days30 = lastNDays(today, 30);
  const last7 = lastNDays(today, 7).map((d) => byDay.get(d)).filter(Boolean) as WearableDay[];
  const avg = (k: keyof WearableDay) => {
    const v = last7.map((r) => r[k]).filter((x): x is number => typeof x === "number");
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `https://${h.get("host") ?? "your-app"}`;
  const sleepAvg = avg("sleep_minutes");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3.5"><p className="text-xs text-fg-muted">Steps · 7-day avg</p><p className="text-2xl font-semibold tabular-nums">{avg("steps")?.toLocaleString("en-IN") ?? "–"}</p></Card>
        <Card className="!p-3.5"><p className="text-xs text-fg-muted">Sleep · 7-day avg</p><p className="text-2xl font-semibold tabular-nums">{sleepAvg ? `${Math.floor(sleepAvg / 60)}h ${sleepAvg % 60}m` : "–"}</p></Card>
        <Card className="!p-3.5"><p className="text-xs text-fg-muted">Resting HR · 7-day avg</p><p className="text-2xl font-semibold tabular-nums">{avg("resting_hr") ?? "–"}</p></Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No wearable data yet">Import your Zepp export below or set up an automatic sync.</EmptyState>
      ) : (
        <>
          <Card>
            <ColumnChart title="Steps" data={days30.map((d) => ({ key: d, label: shortDate(d), value: byDay.get(d)?.steps ?? 0, tooltip: `${shortDate(d)}: ${byDay.get(d)?.steps?.toLocaleString("en-IN") ?? "no data"} steps` }))} height={120} />
          </Card>
          <Card>
            <ColumnChart title="Sleep (hours)" data={days30.map((d) => ({ key: d, label: shortDate(d), value: Math.round(((byDay.get(d)?.sleep_minutes ?? 0) / 60) * 10) / 10, tooltip: `${shortDate(d)}: ${byDay.get(d)?.sleep_minutes ? `${Math.round((byDay.get(d)!.sleep_minutes! / 60) * 10) / 10} h` : "no data"}${byDay.get(d)?.deep_sleep_minutes ? ` (deep ${byDay.get(d)!.deep_sleep_minutes} min)` : ""}` }))} unit=" h" height={120} />
          </Card>
          {rows.some((r) => r.resting_hr) ? (
            <Card>
              <LineChart title="Resting heart rate" points={rows.filter((r) => r.resting_hr).map((r) => ({ date: r.day, value: r.resting_hr!, label: shortDate(r.day), tooltip: `${shortDate(r.day)}: ${r.resting_hr} bpm` }))} unit=" bpm" height={140} />
            </Card>
          ) : null}
        </>
      )}

      {isSelf ? (
        <>
          <Card className="space-y-3">
            <h2 className="font-semibold">Health Connect (Android)</h2>
            <HealthConnectSync origin={origin} status={(hc.data ?? null) as SyncStatus} tz={session.profile.timezone} />
          </Card>
          <Card className="space-y-2">
            <h2 className="font-semibold">Add a day by hand</h2>
            <ManualDayForm today={today} />
          </Card>
          <CsvImport />
          <Card className="space-y-3">
            <h2 className="font-semibold">Other automatic sync (webhook)</h2>
            <p className="text-sm text-fg-muted">
              The Amazfit Helio Strap syncs to the Zepp app, which can write to <strong>Health Connect</strong> on Android (Zepp → Profile → Add accounts → Health Connect). A web app can&apos;t read Health Connect directly, so use any automation app that can read Health Connect and send an HTTP request (for example Tasker, or a &quot;Health Connect to webhook&quot; exporter) to post daily totals to the address below once a day. iPhone users can do the same from Apple Health with a Shortcuts automation.
            </p>
            <TokenCreator origin={origin} />
            {(tokens.data ?? []).length ? (
              <ul className="divide-y divide-border text-sm">
                {(tokens.data as { id: string; label: string; created_at: string; last_used_at: string | null }[]).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>{t.label} <span className="text-xs text-fg-muted">· created {new Date(t.created_at).toLocaleDateString("en-IN")}{t.last_used_at ? ` · last used ${new Date(t.last_used_at).toLocaleDateString("en-IN")}` : " · never used"}</span></span>
                    <form action={revokeIngestToken.bind(null, t.id)}><button className={buttonClass("ghost", "sm")}>Revoke</button></form>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
