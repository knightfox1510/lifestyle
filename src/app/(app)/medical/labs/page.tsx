import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, buttonClass, cx } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { formatDate } from "@/modules/medical/meta";
import { byMarker, refLabel, valueLabel } from "@/modules/medical/labs";
import type { LabFlag, LabResult } from "@/lib/types";
import { AddLabForm } from "./add-lab-form";
import { deleteLabResult, setLabIncludeInAi } from "../actions";

export const metadata = { title: "Blood work & lab results" };

const FLAG_TONE: Record<LabFlag, "danger" | "warn" | "accent" | "neutral"> = { low: "warn", high: "danger", abnormal: "danger", normal: "accent" };

export default async function LabsPage({ searchParams }: PageProps<"/medical/labs">) {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("medical_records", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  const { marker: markerParam } = await searchParams;
  const { data } = await session.supabase
    .from("lab_results")
    .select("*")
    .eq("owner_id", ownerId)
    .order("test_date", { ascending: false })
    .limit(2000);
  const results = (data ?? []) as LabResult[];
  const groups = byMarker(results);
  const selected = typeof markerParam === "string" ? groups.find((g) => g[0].marker.toLowerCase() === markerParam.toLowerCase()) : undefined;
  const outOfRange = groups.filter((g) => g[0].flag && g[0].flag !== "normal");
  const panels = [...new Set(groups.map((g) => g[0].panel ?? "Other"))];

  if (selected) {
    const latest = selected[0];
    const numeric = selected.filter((r) => r.value !== null);
    return (
      <div className="space-y-4">
        <Link href="/medical/labs" className="text-sm text-fg-muted hover:text-fg">← All results</Link>
        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{latest.marker}</h2>
            <span className="text-sm text-fg-muted">{latest.panel}</span>
          </div>
          {numeric.length >= 1 ? (
            <LineChart
              title={`${latest.marker}${latest.unit ? ` (${latest.unit})` : ""}`}
              subtitle={`${numeric.length} result${numeric.length === 1 ? "" : "s"}`}
              points={numeric.map((r) => ({ date: r.test_date, value: Number(r.value), label: formatDate(r.test_date), tooltip: `${formatDate(r.test_date)}: ${valueLabel(r)}${r.flag ? ` (${r.flag})` : ""}` }))}
              band={latest.ref_low !== null || latest.ref_high !== null ? { low: latest.ref_low, high: latest.ref_high } : undefined}
            />
          ) : null}
        </Card>
        <Card>
          <ul className="divide-y divide-border text-sm">
            {selected.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {formatDate(r.test_date)} · <strong>{valueLabel(r)}</strong>{" "}
                  {r.flag ? <Badge tone={FLAG_TONE[r.flag]}>{r.flag}</Badge> : null}{" "}
                  {refLabel(r) ? <span className="text-xs text-fg-muted">ref {refLabel(r)}</span> : null}
                  {!r.include_in_ai ? <> <Badge>hidden from AI</Badge></> : null}
                </span>
                <span className="flex gap-1">
                  {r.document_id ? <Link href={`/medical/documents#${r.document_id}`} className={buttonClass("ghost", "sm")}>Report</Link> : null}
                  {canWrite ? (
                    <form action={setLabIncludeInAi.bind(null, r.id, ownerId, !r.include_in_ai)}>
                      <button className={buttonClass("ghost", "sm")}>{r.include_in_ai ? "Hide from AI" : "Use in AI"}</button>
                    </form>
                  ) : null}
                  {isOwner ? (
                    <form action={deleteLabResult.bind(null, r.id)}>
                      <button className={buttonClass("danger", "sm")} aria-label="Delete result">✕</button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        Upload blood work or other reports under <Link href="/medical/documents" className="text-accent underline">Papers & reports</Link> and use
        “Read with AI” to pull every value in, or add results by hand.
      </p>
      {canWrite ? <AddLabForm ownerId={ownerId} /> : null}

      {groups.length === 0 ? (
        <EmptyState title="No lab results yet">HbA1c, Vitamin D, B12, thyroid, lipids, iron… each marker gets its own trend.</EmptyState>
      ) : (
        <>
          {outOfRange.length ? (
            <Card className="border-danger/40">
              <h2 className="mb-2 text-sm font-semibold">Outside the reference range (latest result)</h2>
              <ul className="flex flex-wrap gap-2">
                {outOfRange.map((g) => (
                  <li key={g[0].id}>
                    <Link href={`/medical/labs?marker=${encodeURIComponent(g[0].marker)}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-2">
                      {g[0].flag === "low" ? "↓" : "↑"} {g[0].marker} <strong>{valueLabel(g[0])}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {panels.map((panel) => (
            <Card key={panel} className="overflow-x-auto">
              <h2 className="mb-2 text-sm font-semibold">{panel}</h2>
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-xs text-fg-muted">
                  <tr>
                    <th className="text-left font-medium">Test</th>
                    <th className="text-right font-medium">Latest</th>
                    <th className="text-right font-medium">Previous</th>
                    <th className="text-right font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {groups
                    .filter((g) => (g[0].panel ?? "Other") === panel)
                    .map((g) => {
                      const [latest, prev] = g;
                      const delta = latest.value !== null && prev?.value != null ? Number(latest.value) - Number(prev.value) : null;
                      return (
                        <tr key={latest.id} className="border-t border-border">
                          <td className="py-2">
                            <Link href={`/medical/labs?marker=${encodeURIComponent(latest.marker)}`} className="hover:underline">{latest.marker}</Link>
                            <span className="block text-xs text-fg-muted">{formatDate(latest.test_date)} · {g.length} result{g.length === 1 ? "" : "s"}</span>
                          </td>
                          <td className={cx("text-right tabular-nums", latest.flag && latest.flag !== "normal" && "font-semibold text-danger")}>
                            {valueLabel(latest)} {latest.flag && latest.flag !== "normal" ? <span className="text-xs">({latest.flag})</span> : null}
                          </td>
                          <td className="text-right tabular-nums text-fg-muted">
                            {prev ? valueLabel(prev) : "–"}
                            {delta !== null && delta !== 0 ? <span className="ml-1 text-xs">{delta > 0 ? "▲" : "▼"}</span> : null}
                          </td>
                          <td className="text-right text-xs text-fg-muted">{refLabel(latest)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
