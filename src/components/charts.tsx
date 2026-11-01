import type { ReactNode } from "react";

/**
 * Small HTML/CSS column chart: crisp text at any width, a hover tooltip per
 * column, an optional 2px overlay line (e.g. 7-day average) and a table view.
 * Marks: ≤24px columns with 4px rounded tops, hairline gridlines.
 */
export type ColumnDatum = { key: string; label: string; value: number; tooltip?: string };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function fmt(n: number) {
  return n >= 10000 ? `${Math.round(n / 1000)}K` : n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

export function ColumnChart({
  title,
  subtitle,
  data,
  unit = "",
  line,
  lineLabel,
  barLabel,
  height = 160,
  labelEvery,
}: {
  title: string;
  subtitle?: ReactNode;
  data: ColumnDatum[];
  unit?: string;
  line?: (number | null)[];
  lineLabel?: string;
  barLabel?: string;
  height?: number;
  labelEvery?: number;
}) {
  const max = niceMax(Math.max(...data.map((d) => d.value), ...(line ?? []).map((v) => v ?? 0)));
  const ticks = [0, max / 2, max];
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 10));
  const n = data.length;
  const points = line
    ?.map((v, i) => (v === null ? null : `${((i + 0.5) / n) * 100},${100 - (v / max) * 100}`))
    .filter(Boolean)
    .join(" ");

  return (
    <figure className="space-y-2">
      <figcaption>
        <p className="text-sm font-semibold">{title}</p>
        {subtitle ? <p className="text-xs text-fg-muted">{subtitle}</p> : null}
      </figcaption>
      {line && barLabel && lineLabel ? (
        <div className="flex gap-4 text-xs text-fg-muted" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-series-1" />{barLabel}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-series-2" />{lineLabel}</span>
        </div>
      ) : null}
      <div className="flex gap-2">
        <div className="relative w-8 shrink-0 text-right text-[11px] tabular-nums text-fg-muted" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>
              {fmt(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-grid" style={{ top: `${100 - (t / max) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end">
              {data.map((d) => (
                <div key={d.key} className="group relative flex h-full flex-1 items-end justify-center px-px" tabIndex={0} aria-label={d.tooltip ?? `${d.label}: ${d.value}${unit}`}>
                  <div
                    className="w-full max-w-6 rounded-t bg-series-1 transition-opacity group-hover:opacity-80"
                    style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                  />
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-xs text-bg shadow group-hover:block group-focus:block">
                    {d.tooltip ?? `${d.label}: ${fmt(d.value)}${unit}`}
                  </div>
                </div>
              ))}
            </div>
            {points ? (
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <polyline points={points} fill="none" stroke="var(--series-2)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            ) : null}
          </div>
          <div className="mt-1 flex text-[11px] text-fg-muted">
            {data.map((d, i) => (
              <span key={d.key} className="flex-1 truncate text-center">
                {i % every === 0 ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-fg-muted">Show as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {data.map((d, i) => (
              <tr key={d.key} className="border-t border-border">
                <td className="py-0.5">{d.label}</td>
                <td className="text-right tabular-nums">{fmt(d.value)}{unit}</td>
                {line ? <td className="text-right tabular-nums text-fg-muted">{line[i] === null ? "" : fmt(line[i]!)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Horizontal bars for categorical breakdowns (e.g. triggers). Values labelled at the bar end. */
export function BarList({ title, items, unit = "" }: { title: string; items: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {items.length === 0 ? (
        <p className="text-sm text-fg-muted">No data yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.label} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm" title={`${i.label}: ${i.value}${unit}`}>
              <span className="truncate text-fg-muted">{i.label}</span>
              <span className="flex items-center gap-2">
                <span className="h-3 rounded-r bg-series-1" style={{ width: `${(i.value / max) * 85}%`, minWidth: 2 }} />
                <span className="text-xs tabular-nums">{i.value}{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export function rollingAverage(values: number[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / window) * 10) / 10;
  });
}
