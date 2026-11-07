import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { estimateUsd, priceFamily } from "@/lib/ai/profile";
import { usageByFeature, type UsageRecord } from "@/lib/ai/usage-report";

export const metadata = { title: "AI usage" };

const money = (n: number) => "$" + (n < 0.01 ? n.toFixed(4) : n.toFixed(2));
const daysAgoIso = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));

/** Which AI features use the most tokens in this household, with estimated cost. */
export default async function AiUsagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  const { days: d } = await searchParams;
  const days = d === "7" ? 7 : d === "90" ? 90 : 30;
  const since = daysAgoIso(days);
  const full = await session.supabase
    .from("ai_usage")
    .select("feature, user_id, created_at, input_tokens, output_tokens, thinking_tokens, cached_tokens, search_queries, model, from_cache, attempts, batch")
    .eq("household_id", session.household.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10000);
  // Before the database update only input/output tokens were recorded.
  const old = full.error
    ? await session.supabase.from("ai_usage").select("feature, user_id, created_at, input_tokens, output_tokens").eq("household_id", session.household.id).gte("created_at", since).limit(10000)
    : null;
  const rows = ((full.error ? old?.data : full.data) ?? []) as UsageRecord[];
  const report = usageByFeature(rows);
  const names = Object.fromEntries(session.members.map((m) => [m.user_id, m.user_id === session.userId ? "You" : m.display_name]));
  const personCost = new Map<string, number>();
  for (const r of rows) personCost.set(r.user_id, (personCost.get(r.user_id) ?? 0) + estimateUsd(r));
  const modelCount = new Map<string, number>();
  for (const r of rows) if (!r.from_cache) modelCount.set(priceFamily(r.model), (modelCount.get(priceFamily(r.model)) ?? 0) + 1);
  const noThinking = rows.some((r) => !r.from_cache && r.thinking_tokens == null);

  return (
    <>
      <PageHeader title="AI usage" subtitle="Which features use the most tokens, and roughly what they cost." />
      <div className="space-y-4">
        <div className="flex gap-1.5 text-sm">
          {[7, 30, 90].map((n) => (
            <Link key={n} href={`/settings/ai-usage?days=${n}`} className={`rounded-full border px-3 py-1 ${n === days ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted"}`}>
              {n} days
            </Link>
          ))}
        </div>
        {!rows.length ? (
          <EmptyState title="No AI requests in this period" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card className="!p-3.5"><p className="text-xs text-fg-muted">Estimated cost</p><p className="text-2xl font-semibold tabular-nums">{money(report.totalUsd)}</p></Card>
              <Card className="!p-3.5"><p className="text-xs text-fg-muted">AI requests</p><p className="text-2xl font-semibold tabular-nums">{report.requests}</p></Card>
              <Card className="!p-3.5"><p className="text-xs text-fg-muted">Reused (free)</p><p className="text-2xl font-semibold tabular-nums">{report.cached}</p></Card>
            </div>
            <Card className="overflow-x-auto !p-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-fg-muted">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">Feature</th>
                    <th className="px-2 py-2 text-right font-medium">Requests</th>
                    <th className="px-2 py-2 text-right font-medium">Avg in</th>
                    <th className="px-2 py-2 text-right font-medium">Avg out + thinking</th>
                    <th className="px-2 py-2 text-right font-medium">Est. cost</th>
                    <th className="px-3 py-2 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((l) => (
                    <tr key={l.feature} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        {l.label}
                        {l.searches ? <span className="block text-xs text-fg-muted">{l.searches} web searches</span> : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {l.requests}
                        {l.cached ? <span className="block text-xs text-fg-muted">+{l.cached} reused</span> : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{k(l.avgIn)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {k(l.avgOut)}
                        {l.avgThinking ? <span className="text-fg-muted"> + {k(l.avgThinking)}</span> : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{money(l.usd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Math.round(l.share * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="space-y-1 !p-4 text-sm">
                <p className="font-semibold">By person</p>
                {[...personCost].sort((a, b) => b[1] - a[1]).map(([id, v]) => (
                  <p key={id} className="flex justify-between"><span>{names[id] ?? "Former member"}</span><span className="tabular-nums">{money(v)}</span></p>
                ))}
              </Card>
              <Card className="space-y-1 !p-4 text-sm">
                <p className="font-semibold">By model</p>
                {[...modelCount].map(([m, n]) => (
                  <p key={m} className="flex justify-between"><span className="capitalize">{m}</span><span className="tabular-nums">{n} requests</span></p>
                ))}
                <p className="pt-1 text-xs text-fg-muted">Pro costs about 4× Flash. With &ldquo;Best&rdquo; chosen, only the AI coach, doctor visit summary, medicine checks, medical documents, nutrition report and Ask AI with &ldquo;Think harder&rdquo; use Pro; simple reading jobs (labels, receipts, lookups) use Flash-Lite, about half Flash&apos;s price.</p>
              </Card>
            </div>
          </>
        )}
        <Card className="space-y-1.5 !p-4 text-xs text-fg-muted">
          <p className="text-sm font-semibold text-fg">How the estimate works</p>
          <p>
            Approximate Google list prices per million tokens: Flash $0.50 in / $3 out, Pro $2 in / $12 out. Hidden &ldquo;thinking&rdquo; is billed as output, a prompt start Gemini has seen recently is billed at about 10%, and web searches cost about $14 per 1,000 after Google&apos;s monthly free allowance. Your Google bill is the real figure; this is for comparing features.
          </p>
          {noThinking ? <p>Requests from before the latest database update didn&apos;t record thinking tokens, reuse or the model, so their cost shows lower than it really was.</p> : null}
        </Card>
      </div>
    </>
  );
}
