import type { DayStatus } from "@/lib/today";
import { dayScore } from "@/modules/engagement/rings";
import { RING_META } from "@/components/today/day-views";
import type { T } from "@/lib/i18n/core";

/** A tiny line of daily values (0–1), last point dotted. */
function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const w = 96, h = 26;
  const pts = values.map((v, i) => (v == null ? null : [(i / Math.max(1, values.length - 1)) * w, h - 3 - v * (h - 6)] as const));
  const line = pts.filter(Boolean).map((p) => `${p![0].toFixed(1)},${p![1].toFixed(1)}`).join(" ");
  const last = [...pts].reverse().find(Boolean);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 overflow-visible">
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} style={{ strokeDasharray: 1, animation: "line-draw .9s cubic-bezier(.3,.8,.3,1) both" }} />
      {last ? <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} /> : null}
    </svg>
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * This week's health score (average of each day's goals done, 0–100) against
 * last week, and a 14-day sparkline per daily goal (water, meals, meds,
 * check-in).
 */
export function HealthScoreCard({ statuses, t }: { statuses: DayStatus[]; t: T }) {
  const last14 = statuses.slice(-14);
  const week = statuses.slice(-7).filter((d) => d.rings.length);
  const before = statuses.slice(-14, -7).filter((d) => d.rings.length);
  const now = avg(week.map((d) => dayScore(d.rings)));
  const then = avg(before.map((d) => dayScore(d.rings)));
  if (now == null) return null;
  const delta = then == null ? null : Math.round(now - then);
  const keys = [...new Set(statuses.flatMap((d) => d.rings.map((r) => r.key)))];
  return (
    <section className="rounded-[22px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)] [animation:fade-in_.3s_ease-out]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{t("Health score · this week")}</p>
          <p className="mt-1 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{Math.round(now)}</p>
        </div>
        {delta != null ? (
          <span className={`mb-1 rounded-full px-2.5 py-1 text-[13px] font-medium tabular-nums ${delta >= 0 ? "bg-accent-soft text-fg" : "bg-danger-soft text-danger"}`}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)} {t("vs last week")}
          </span>
        ) : null}
      </div>
      <ul className="mt-3 divide-y divide-border">
        {keys.map((k) => {
          const vals = last14.map((d) => d.rings.find((r) => r.key === k)?.pct ?? null);
          const wk = avg(statuses.slice(-7).map((d) => d.rings.find((r) => r.key === k)?.pct).filter((v): v is number => v != null));
          return (
            <li key={k} className="flex items-center gap-3 py-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: RING_META[k].color }} />
              <span className="min-w-0 flex-1 truncate text-[14px]">{t(RING_META[k].label)}</span>
              <Sparkline values={vals} color={RING_META[k].color} />
              <span className="w-10 text-right text-[13px] font-medium tabular-nums">{wk == null ? "–" : `${Math.round(wk * 100)}%`}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] text-fg-muted">{t("Each day's goals done, averaged over the week. Lines show the last 14 days.")}</p>
    </section>
  );
}
