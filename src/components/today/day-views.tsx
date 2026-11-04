import type { Ring } from "@/modules/engagement/rings";
import type { ArcEvent, DayStatus } from "@/lib/today";
import Link from "next/link";
import { cx } from "@/components/ui";
import type { T } from "@/lib/i18n/core";

export const RING_META: Record<Ring["key"], { label: string; color: string; bg: string }> = {
  water: { label: "Water", color: "var(--cat-water)", bg: "color-mix(in oklab, var(--cat-water) 12%, var(--surface))" },
  food: { label: "Meals", color: "var(--cat-food)", bg: "color-mix(in oklab, var(--cat-food) 12%, var(--surface))" },
  meds: { label: "Meds & supplements", color: "var(--cat-meds)", bg: "color-mix(in oklab, var(--cat-meds) 12%, var(--surface))" },
  check: { label: "Check-in", color: "var(--cat-check)", bg: "color-mix(in oklab, var(--cat-check) 14%, var(--surface))" },
};

/** Litres without trailing zeros: 0, 0.25, 1.5, 2. */
const litres = (ml: number) => String(Math.round(ml / 10) / 100);

export function ringValue(r: Ring, t: T, past = false) {
  if (r.key === "water") return `${litres(r.value)} / ${litres(r.target)} L`;
  if (r.key === "check") return r.pct >= 1 ? t("Done") : past ? t("Not done") : t("Tonight");
  return `${r.value} / ${r.target}`;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Signature view: the day drawn as the sun's path from 6 am to 10 pm; each log is a bead where it happened. */
export function DayArc({ events, now, score, rings, t, past = false }: { events: ArcEvent[]; now: string; score: number; rings: Ring[]; t: T; past?: boolean }) {
  const cx0 = 170, cy0 = 162, r = 142;
  const START = 6 * 60, END = 22 * 60;
  const pos = (min: number) => {
    const f = Math.min(1, Math.max(0, (min - START) / (END - START)));
    const a = Math.PI * (1 - f);
    return [cx0 + r * Math.cos(a), cy0 - r * Math.sin(a)] as const;
  };
  const nowMin = toMin(now);
  const [sx, sy] = pos(START);
  const [nx, ny] = pos(nowMin);
  const elapsed = nowMin > START;
  // Nudge beads that share a spot outward/inward so they stay visible.
  const placed = events.map((e, i) => {
    const sameBefore = events.slice(0, i).filter((x) => Math.abs(toMin(x.time) - toMin(e.time)) < 12).length;
    const [x, y] = pos(toMin(e.time));
    const k = sameBefore === 0 ? 0 : (sameBefore % 2 ? 1 : -1) * Math.ceil(sameBefore / 2) * 11;
    const dx = (x - cx0) / r, dy = (y - cy0) / r;
    return { x: x + dx * k, y: y + dy * k, kind: e.kind, key: `${e.kind}-${e.time}-${i}` };
  });
  const label = (min: number, text: string) => {
    const [x, y] = pos(min);
    return <text key={text} x={cx0 + (x - cx0) * 0.8} y={cy0 - (cy0 - y) * 0.8 + 4} textAnchor="middle" fontSize="11" fill="var(--fg-muted)">{text}</text>;
  };
  return (
    <div>
      <svg viewBox="0 0 340 176" className="w-full" role="img" aria-label={t("Your day: {n} logs so far, {score}% of today's goals", { n: events.length, score })}>
        <path d={`M ${cx0 - r} ${cy0} A ${r} ${r} 0 0 1 ${cx0 + r} ${cy0}`} fill="none" stroke="var(--arc-track)" strokeWidth="14" strokeLinecap="round" />
        {elapsed ? <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${nx} ${ny}`} pathLength={1} fill="none" stroke="var(--sun)" strokeOpacity=".25" strokeWidth="14" strokeLinecap="round" style={{ strokeDasharray: 1, animation: "line-draw 1.1s cubic-bezier(.3,.8,.3,1) both" }} /> : null}
        {label(START, t("6 am"))}
        {label(12 * 60, t("noon"))}
        {label(18 * 60, t("6 pm"))}
        {label(END, t("10 pm"))}
        {placed.map((b, i) => (
          <circle key={b.key} cx={b.x} cy={b.y} r="5.5" fill={RING_META[b.kind].color} stroke="var(--bg)" strokeWidth="2" style={{ transformOrigin: `${b.x}px ${b.y}px`, transformBox: "view-box", animation: `pop .4s ${(0.5 + i * 0.05).toFixed(2)}s ease-out both` }} />
        ))}
        {nowMin >= START && nowMin <= END && !past ? (
          <>
            <circle cx={nx} cy={ny} r="10" fill="var(--sun)" opacity=".35" className="motion-reduce:hidden" style={{ transformOrigin: `${nx}px ${ny}px`, transformBox: "view-box", animation: "sun-pulse 2.6s ease-out infinite" }} />
            <circle cx={nx} cy={ny} r="10" fill="var(--sun)" stroke="var(--bg)" strokeWidth="3" />
          </>
        ) : null}
        <text x={cx0} y={cy0 - 40} textAnchor="middle" fontSize="38" fontWeight="650" fill="var(--fg)" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>{score}%</text>
        <text x={cx0} y={cy0 - 18} textAnchor="middle" fontSize="12" fill="var(--fg-muted)">{past ? t("of the day's goals") : t("of today's goals")}</text>
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {rings.map((ring) => (
          <div key={ring.key} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: RING_META[ring.key].color }} />
            <span className="text-fg-muted">{t(RING_META[ring.key].label)}</span>
            <span className="ml-auto whitespace-nowrap font-medium tabular">{ring.pct >= 1 ? "✓" : ringValue(ring, t, past)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Quiet view: one segmented bar per goal, numbers first. */
export function DayBars({ rings, t, past = false }: { rings: Ring[]; t: T; past?: boolean }) {
  return (
    <div className="space-y-4">
      {rings.map((ring) => {
        const n = 10, on = Math.round(ring.pct * n);
        return (
          <div key={ring.key}>
            <div className="mb-1.5 flex justify-between text-[14px]">
              <span>{t(RING_META[ring.key].label)}</span>
              <span className="font-mono text-[13px] text-fg-muted">{ringValue(ring, t, past)}</span>
            </div>
            <div className="grid h-1.5 gap-[3px]" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {Array.from({ length: n }, (_, i) => (
                <i key={i} className="rounded-[2px] transition-colors duration-300" style={{ background: i < on ? "var(--fg)" : "var(--border)", animation: i < on ? `fade-in .3s ${(i * 0.04).toFixed(2)}s ease-out both` : undefined }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Friendly view: a tinted tile per goal with a big number. */
export function DayTiles({ rings, t, past = false }: { rings: Ring[]; t: T; past?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {rings.map((ring) => (
        <div key={ring.key} className="flex min-h-[112px] flex-col justify-between rounded-[22px] p-4" style={{ background: RING_META[ring.key].bg }}>
          <span className="text-[13px] font-medium">{t(RING_META[ring.key].label)}</span>
          <div>
            <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular">{ringValue(ring, t, past)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${RING_META[ring.key].color} 20%, transparent)` }}>
              <i className="block h-full origin-left rounded-full transition-[width] duration-500" style={{ width: `${ring.pct * 100}%`, background: RING_META[ring.key].color, animation: "grow-x .7s cubic-bezier(.3,.8,.3,1) both" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mon–Sun: filled = day closed, half = something logged, empty = nothing. */
/** The 7 days up to the one shown; tap a day to see it (today is the plain Today page). */
export function WeekStrip({ week, today, selected = today, t, locale }: { week: DayStatus[]; today: string; selected?: string; t: T; locale: string }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 text-center" aria-label={t("This week")}>
      {week.map((d) => (
        <Link key={d.date} href={d.date === today ? "/" : `/?date=${d.date}`} scroll={false} className="pressable space-y-1 rounded-xl" aria-current={d.date === selected ? "date" : undefined}>
          <span className={cx("block text-[11px]", d.date === selected ? "font-semibold text-fg" : "text-fg-muted")}>
            {new Date(`${d.date}T12:00:00Z`).toLocaleDateString(locale, { weekday: "narrow", timeZone: "UTC" })}
          </span>
          <span
            className={cx("mx-auto block h-7 rounded-[9px]", d.date === selected && "ring-2 ring-accent/30 ring-offset-2 ring-offset-surface")}
            title={d.closed ? t("Day closed") : d.any ? t("Something logged") : t("Nothing logged")}
            style={{ background: d.closed ? "var(--accent)" : d.any ? "linear-gradient(to top, var(--accent) 45%, var(--surface-2) 45%)" : "var(--surface-2)" }}
          />
        </Link>
      ))}
    </div>
  );
}
