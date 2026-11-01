"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Input, Textarea, cx } from "@/components/ui";
import type { DailyCheckin } from "@/lib/types";
import { saveCheckinField } from "@/app/(app)/checkin/actions";

export const SCALES = [
  { field: "sleep_quality", label: "Sleep", low: "😫", high: "😴" },
  { field: "mood", label: "Mood", low: "😞", high: "😄" },
  { field: "energy", label: "Energy", low: "🪫", high: "⚡" },
  { field: "stress", label: "Stress", low: "😌", high: "😰" },
] as const;

type ScaleField = (typeof SCALES)[number]["field"];

export function CheckinForm({
  ownerId,
  date,
  checkin,
  compact = false,
  canWrite,
}: {
  ownerId: string;
  date: string;
  checkin: DailyCheckin | null;
  compact?: boolean;
  canWrite: boolean;
}) {
  const [, start] = useTransition();
  const [values, setValue] = useOptimistic(
    {
      sleep_quality: checkin?.sleep_quality ?? null,
      mood: checkin?.mood ?? null,
      energy: checkin?.energy ?? null,
      stress: checkin?.stress ?? null,
    } as Record<ScaleField, number | null>,
    (state, change: { field: ScaleField; value: number | null }) => ({ ...state, [change.field]: change.value }),
  );
  const [hours, setHours] = useState(checkin?.sleep_hours?.toString() ?? "");
  const [notes, setNotes] = useState(checkin?.notes ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-3">
      {SCALES.map((s) => (
        <div key={s.field} className="flex items-center gap-2">
          <span className={cx("shrink-0 text-sm", compact ? "w-14" : "w-16 font-medium")}>{s.label}</span>
          <span aria-hidden className="text-sm">{s.low}</span>
          <div className="flex flex-1 gap-1" role="radiogroup" aria-label={s.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={values[s.field] === n}
                disabled={!canWrite}
                onClick={() =>
                  start(async () => {
                    const next = values[s.field] === n ? null : n;
                    setValue({ field: s.field, value: next });
                    await saveCheckinField(ownerId, date, s.field, next);
                  })
                }
                className={cx(
                  "h-8 flex-1 rounded-lg text-sm tabular-nums transition",
                  values[s.field] === n ? "bg-accent font-semibold text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <span aria-hidden className="text-sm">{s.high}</span>
        </div>
      ))}
      {!compact ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await saveCheckinField(ownerId, date, "sleep_hours", hours === "" ? null : Number(hours));
              await saveCheckinField(ownerId, date, "notes", notes);
              setSaved(true);
            });
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-16 text-sm font-medium">Slept</span>
            <Input type="number" min={0} max={24} step={0.5} value={hours} onChange={(e) => { setHours(e.target.value); setSaved(false); }} className="w-24" disabled={!canWrite} aria-label="Hours slept" />
            <span className="text-sm text-fg-muted">hours</span>
          </div>
          <Textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} maxLength={1000} placeholder="Anything notable today? (period, travel, illness…)" disabled={!canWrite} className="min-h-14" />
          {canWrite ? (
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" variant="secondary">Save</Button>
              {saved ? <span className="text-sm text-accent">Saved</span> : null}
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
