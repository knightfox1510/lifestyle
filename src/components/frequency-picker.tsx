"use client";

import { cx, Input } from "@/components/ui";
import { DAY_SHORT, type Frequency } from "@/modules/schedule";

export type FrequencyValue = { frequency: Frequency; days: number[]; every: number };

/** Every day · some days of the week · once a week · every N days. */
export function FrequencyPicker({ value, onChange, startLabel }: { value: FrequencyValue; onChange: (v: FrequencyValue) => void; startLabel?: string }) {
  const chip = (on: boolean) => cx("rounded-full px-3 py-1 text-xs", on ? "bg-accent-soft font-medium text-accent" : "bg-surface-2 text-fg-muted");
  const set = (patch: Partial<FrequencyValue>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How often">
        {(
          [
            ["daily", "Every day"],
            ["days", "Some days"],
            ["weekly", "Once a week"],
            ["every_n", "Every few days"],
          ] as const
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={value.frequency === f}
            className={chip(value.frequency === f)}
            onClick={() => set({ frequency: f, days: f === "weekly" ? [value.days[0] ?? 0] : f === "days" && value.days.length < 2 ? [1, 3, 5] : value.days, every: f === "every_n" && value.every < 2 ? 14 : value.every })}
          >
            {label}
          </button>
        ))}
      </div>
      {value.frequency === "days" || value.frequency === "weekly" ? (
        <div className="flex gap-1" role="group" aria-label="Days">
          {DAY_SHORT.map((l, d) => {
            const on = value.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => set({ days: value.frequency === "weekly" ? [d] : on ? value.days.filter((x) => x !== d) : [...value.days, d].sort() })}
                className={cx("h-8 w-10 rounded-full text-xs", on ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted")}
              >
                {l}
              </button>
            );
          })}
        </div>
      ) : null}
      {value.frequency === "every_n" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Every
          <Input type="number" min={2} max={365} value={value.every} onChange={(e) => set({ every: Math.max(2, Math.min(365, Number(e.target.value) || 2)) })} className="!h-8 w-20" aria-label="Every how many days" />
          days
          {[7, 14, 30].map((n) => (
            <button key={n} type="button" className={chip(value.every === n)} onClick={() => set({ every: n })}>
              {n === 7 ? "weekly" : n === 14 ? "fortnightly" : "monthly"}
            </button>
          ))}
          <span className="basis-full text-xs text-fg-muted">Counted from {startLabel ?? "the start date"}.</span>
        </div>
      ) : null}
    </div>
  );
}

/** Columns to save for a frequency choice. */
export function repeatColumns(v: FrequencyValue): { days_of_week: number[] | null; repeat_every_days: number | null } {
  if (v.frequency === "every_n") return { days_of_week: null, repeat_every_days: v.every };
  if (v.frequency === "weekly") return { days_of_week: v.days.slice(0, 1), repeat_every_days: null };
  if (v.frequency === "days" && v.days.length && v.days.length < 7) return { days_of_week: [...v.days].sort(), repeat_every_days: null };
  return { days_of_week: null, repeat_every_days: null };
}
