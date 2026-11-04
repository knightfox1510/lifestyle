"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

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

/** A stable id for SVG gradients (server components can't use useId). */
function gid(seed: string) {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 1_000_003;
  return `g${h}`;
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
  markers,
  compare,
  compareLabel,
  best,
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
  /** Dashed rules on given columns, e.g. "Surgery" on that day. */
  markers?: { key: string; label: string }[];
  /** The previous period's value for each column (e.g. same weekday last week): a dashed line, and "vs last week" above the chart. */
  compare?: (number | null)[];
  compareLabel?: string;
  /** Mark the best column with a star: the highest value (steps, sleep). */
  best?: "max";
}) {
  // Phones have no hover: tap a column to pin its tooltip, tap again to hide it.
  const [pin, setPin] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), ...(line ?? []).map((v) => v ?? 0), ...(compare ?? []).map((v) => v ?? 0)));
  const ticks = [0, max / 2, max];
  // About 5 date labels whatever the width, so they never get cut off.
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 5));
  const n = data.length;
  // Markers on the same column are one pin with all their labels (duplicates dropped).
  const markerGroups: { key: string; index: number; labels: string[] }[] = [];
  for (const m of markers ?? []) {
    const index = data.findIndex((d) => d.key === m.key);
    if (index < 0) continue;
    const g = markerGroups.find((x) => x.index === index);
    if (g) {
      if (!g.labels.includes(m.label)) g.labels.push(m.label);
    } else markerGroups.push({ key: m.key, index, labels: [m.label] });
  }
  markerGroups.sort((a, b) => a.index - b.index);
  const toPoints = (vals?: (number | null)[]) =>
    vals
      ?.map((v, i) => (v === null ? null : `${((i + 0.5) / n) * 100},${100 - (v / max) * 100}`))
      .filter(Boolean)
      .join(" ");
  const points = toPoints(line);
  const comparePoints = toPoints(compare);
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const nowAvg = avg(data.map((d) => d.value));
  const thenAvg = compare ? avg(compare) : null;
  const change = nowAvg != null && thenAvg ? Math.round(((nowAvg - thenAvg) / thenAvg) * 100) : null;
  const bestIndex = best === "max" && data.some((d) => d.value > 0) ? data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0) : -1;

  return (
    <figure className="space-y-2">
      <figcaption>
        <p className="text-sm font-semibold">{title}</p>
        {subtitle ? <p className="text-xs text-fg-muted">{subtitle}</p> : null}
      </figcaption>
      {(line && barLabel && lineLabel) || compare || bestIndex >= 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          {barLabel ? <span className="flex items-center gap-1.5" aria-hidden><span className="inline-block size-2.5 rounded-sm bg-series-1" />{barLabel}</span> : null}
          {line && lineLabel ? <span className="flex items-center gap-1.5" aria-hidden><span className="inline-block h-0.5 w-4 rounded bg-series-2" />{lineLabel}</span> : null}
          {compare ? <span className="flex items-center gap-1.5" aria-hidden><span className="inline-block w-4 border-t-2 border-dashed border-fg-muted/70" />{compareLabel ?? "Last week"}</span> : null}
          {bestIndex >= 0 ? <span className="flex items-center gap-1" aria-hidden><span className="text-sun">★</span> best {data[bestIndex].label}</span> : null}
          {change != null && thenAvg != null && nowAvg != null ? (
            <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 tabular-nums text-fg">
              avg {fmt(nowAvg >= 100 ? Math.round(nowAvg) : Math.round(nowAvg * 10) / 10)}{unit} vs {fmt(thenAvg >= 100 ? Math.round(thenAvg) : Math.round(thenAvg * 10) / 10)}{unit} <span className={change === 0 ? "text-fg-muted" : "font-semibold"}>({change > 0 ? "+" : ""}{change}%)</span>
            </span>
          ) : null}
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
              {data.map((d, i) => (
                <div key={d.key} className="group relative flex h-full flex-1 cursor-pointer items-end justify-center px-px" tabIndex={0} aria-label={d.tooltip ?? `${d.label}: ${d.value}${unit}`} onClick={() => setPin(pin === i ? null : i)}>
                  {i === bestIndex ? <span aria-hidden className="pointer-events-none absolute z-[1] text-[12px] leading-none text-sun drop-shadow-sm" style={{ bottom: `calc(${(d.value / max) * 100}% + 3px)` }}>★</span> : null}
                  <div
                    className={cx("w-full max-w-6 origin-bottom rounded-t transition-opacity group-hover:opacity-80", pin !== null && pin !== i && "opacity-50")}
                    style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0, background: "linear-gradient(to top, color-mix(in oklab, var(--series-1) 55%, transparent), var(--series-1))", animation: `bar-grow .55s ${Math.min(0.4, data.indexOf(d) * 0.015).toFixed(3)}s cubic-bezier(.3,.8,.3,1) both` }}
                  />
                  <div className={cx("pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-xs text-bg shadow group-hover:block group-focus:block", pin === i ? "block [animation:toast-in_.15s_ease-out]" : "hidden", i < n / 4 ? "left-0" : i > (n * 3) / 4 ? "right-0" : "")}>
                    {d.tooltip ?? `${d.label}: ${fmt(d.value)}${unit}`}
                  </div>
                </div>
              ))}
            </div>
            {points || comparePoints ? (
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                {comparePoints ? <polyline points={comparePoints} fill="none" stroke="var(--fg-muted)" strokeOpacity={0.7} strokeWidth={1.75} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /> : null}
                {points ? <polyline points={points} fill="none" stroke="var(--series-2)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /> : null}
              </svg>
            ) : null}
            {markerGroups.map((g, gi) => (
              <div key={g.key} className="pointer-events-none absolute inset-y-0 border-l border-dashed border-fg/60" style={{ left: `${((g.index + 0.5) / n) * 100}%` }}>
                <span
                  className={cx("absolute -top-2 flex size-4 items-center justify-center rounded-full bg-fg text-[10px] font-semibold leading-none text-bg", g.index > n / 2 ? "right-0.5" : "left-0.5")}
                  aria-hidden
                >
                  {gi + 1}
                </span>
              </div>
            ))}
          </div>
          <div className="relative mt-1 h-4 text-[11px] text-fg-muted">
            {data.map((d, i) =>
              i % every === 0 || i === n - 1 ? (
                i !== n - 1 && n - 1 - i < every / 2 ? null : (
                  <span
                    key={d.key}
                    className={cx("absolute whitespace-nowrap", i === 0 ? "left-0" : i === n - 1 ? "right-0" : "-translate-x-1/2")}
                    style={i === 0 || i === n - 1 ? undefined : { left: `${((i + 0.5) / n) * 100}%` }}
                  >
                    {d.label}
                  </span>
                )
              ) : null,
            )}
          </div>
        </div>
      </div>
      {markerGroups.length ? (
        <ol className="space-y-0.5 text-xs text-fg-muted">
          {markerGroups.map((g, gi) => (
            <li key={g.key} className="flex gap-1.5">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-fg text-[10px] font-semibold text-bg">{gi + 1}</span>
              <span>
                <span className="font-medium text-fg">{data[g.index].label}</span>: {g.labels.join(", ")}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
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


/**
 * Line over time for a single measure (weight, a lab marker…). Points are
 * spaced by date, with an optional shaded "normal" band and a dashed target.
 * HTML dots (≥8px) carry hover tooltips; the line is a 2px non-scaling SVG stroke.
 */
export function LineChart({
  title,
  subtitle,
  points,
  unit = "",
  band,
  target,
  targetLabel,
  height = 180,
}: {
  title: string;
  subtitle?: ReactNode;
  points: { date: string; value: number; label: string; tooltip?: string }[];
  unit?: string;
  band?: { low: number | null; high: number | null };
  target?: number | null;
  targetLabel?: string;
  height?: number;
}) {
  const [pin, setPin] = useState<number | null>(null);
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = [...sorted.map((p) => p.value), ...(target != null ? [target] : []), ...(band?.low != null ? [band.low] : []), ...(band?.high != null ? [band.high] : [])];
  let min = Math.min(...values);
  let max = Math.max(...values);
  const pad = (max - min) * 0.15 || Math.abs(max) * 0.05 || 1;
  min -= pad;
  max += pad;
  const t0 = new Date(sorted[0].date).getTime();
  const t1 = new Date(sorted[sorted.length - 1].date).getTime();
  const x = (d: string) => (t1 === t0 ? 50 : ((new Date(d).getTime() - t0) / (t1 - t0)) * 96 + 2);
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 100;
  const ticks = [min + pad, (min + max) / 2, max - pad];
  const fmtV = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString());
  const area = gid(`${title}-${sorted.length}-area`);

  return (
    <figure className="space-y-2">
      <figcaption>
        <p className="text-sm font-semibold">{title}</p>
        {subtitle ? <p className="text-xs text-fg-muted">{subtitle}</p> : null}
      </figcaption>
      {band || target != null ? (
        <div className="flex flex-wrap gap-4 text-xs text-fg-muted" aria-hidden>
          {band ? <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-accent-soft ring-1 ring-accent/30" />Reference range</span> : null}
          {target != null ? <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-series-2" />{targetLabel ?? "Target"}</span> : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        <div className="relative w-9 shrink-0 text-right text-[11px] tabular-nums text-fg-muted" style={{ height }}>
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>{fmtV(t)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {ticks.map((t, i) => (
            <div key={i} className="absolute inset-x-0 h-px bg-grid" style={{ top: `${y(t)}%` }} />
          ))}
          {band && (band.low != null || band.high != null) ? (
            <div
              className="absolute inset-x-0 bg-accent-soft/70"
              style={{ top: `${y(band.high ?? max)}%`, bottom: `${100 - y(band.low ?? min)}%` }}
            />
          ) : null}
          {target != null ? <div className="absolute inset-x-0 h-0.5 bg-series-2" style={{ top: `${y(target)}%` }} /> : null}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={area} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {sorted.length > 1 ? (
              <polygon
                points={`${x(sorted[0].date)},100 ${sorted.map((p) => `${x(p.date)},${y(p.value)}`).join(" ")} ${x(sorted[sorted.length - 1].date)},100`}
                fill={`url(#${area})`}
                style={{ animation: "fade-in .8s ease-out both" }}
              />
            ) : null}
            <polyline
              pathLength={1}
              style={{ strokeDasharray: 1, strokeDashoffset: 0, animation: "line-draw 1s cubic-bezier(.3,.8,.3,1) both" }}
              points={sorted.map((p) => `${x(p.date)},${y(p.value)}`).join(" ")}
              fill="none"
              stroke="var(--series-1)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {sorted.map((p, i) => (
            <div
              key={`${p.date}-${i}`}
              tabIndex={0}
              aria-label={p.tooltip ?? `${p.label}: ${p.value}${unit}`}
              className="group absolute size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: `${x(p.date)}%`, top: `${y(p.value)}%` }}
              onClick={() => setPin(pin === i ? null : i)}
            >
              <span className={cx("absolute rounded-full bg-series-1 ring-2 ring-surface transition-transform", pin === i ? "inset-1 scale-125" : "inset-[7px]")} />
              <span className={cx("pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-xs text-bg shadow group-hover:block group-focus:block", pin === i ? "block" : "hidden", x(p.date) < 20 ? "left-0" : x(p.date) > 80 ? "right-0" : "left-1/2 -translate-x-1/2")}>
                {p.tooltip ?? `${p.label}: ${p.value}${unit}`}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-11 flex justify-between text-[11px] text-fg-muted">
        <span>{sorted[0].label}</span>
        {sorted.length > 1 ? <span>{sorted[sorted.length - 1].label}</span> : null}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-fg-muted">Show as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {[...sorted].reverse().map((p, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-0.5">{p.label}</td>
                <td className="text-right tabular-nums">{p.value}{unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
