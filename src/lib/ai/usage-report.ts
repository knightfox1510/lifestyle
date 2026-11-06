import { estimateUsd, profileFor, type UsageRow } from "@/lib/ai/profile";

export type UsageRecord = UsageRow & { feature: string; user_id: string; created_at: string; from_cache?: boolean | null; attempts?: number | null };

export type FeatureLine = { feature: string; label: string; requests: number; cached: number; avgIn: number; avgOut: number; avgThinking: number; searches: number; usd: number; share: number };

/** Per-feature totals, most expensive first (pure; unit-tested). */
export function usageByFeature(rows: UsageRecord[]) {
  const by = new Map<string, UsageRecord[]>();
  for (const r of rows) by.set(r.feature, [...(by.get(r.feature) ?? []), r]);
  const total = rows.reduce((a, r) => a + estimateUsd(r), 0);
  const lines: FeatureLine[] = [...by].map(([feature, rs]) => {
    const paid = rs.filter((r) => !r.from_cache);
    const avg = (f: (r: UsageRecord) => number) => (paid.length ? Math.round(paid.reduce((a, r) => a + f(r), 0) / paid.length) : 0);
    const usd = rs.reduce((a, r) => a + estimateUsd(r), 0);
    return {
      feature,
      label: profileFor(feature).label,
      requests: paid.length,
      cached: rs.length - paid.length,
      avgIn: avg((r) => r.input_tokens ?? 0),
      avgOut: avg((r) => r.output_tokens ?? 0),
      avgThinking: avg((r) => r.thinking_tokens ?? 0),
      searches: paid.reduce((a, r) => a + (r.search_queries ?? 0), 0),
      usd,
      share: total ? usd / total : 0,
    };
  });
  return { lines: lines.sort((a, b) => b.usd - a.usd), totalUsd: total, requests: rows.filter((r) => !r.from_cache).length, cached: rows.filter((r) => r.from_cache).length };
}
