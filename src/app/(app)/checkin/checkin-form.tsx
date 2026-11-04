"use client";

import { useState, useTransition } from "react";
import { Button, Input, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import type { DailyCheckin } from "@/lib/types";
import { saveCheckinField } from "@/app/(app)/checkin/actions";
import { SCALES, type ScaleField } from "@/modules/checkin/meta";

/**
 * The day's check-in. Each tap saves on its own. The value shown is kept
 * here (not a temporary "optimistic" one), so it stays put on screens that
 * don't reload after saving (Close your day, the + sheet); a failed save is
 * undone and explained.
 */
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
  const { toast } = useToast();
  const [, start] = useTransition();
  const [values, setValues] = useState<Record<ScaleField, number | null>>({
    sleep_quality: checkin?.sleep_quality ?? null,
    mood: checkin?.mood ?? null,
    energy: checkin?.energy ?? null,
    stress: checkin?.stress ?? null,
  });
  const [hours, setHours] = useState(checkin?.sleep_hours?.toString() ?? "");
  const [notes, setNotes] = useState(checkin?.notes ?? "");
  const [savedField, setSavedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [started, setStarted] = useState(Boolean(checkin && (checkin.sleep_quality ?? checkin.mood ?? checkin.energy ?? checkin.stress ?? checkin.sleep_hours) != null));

  function tap(field: ScaleField, n: number) {
    const before = values[field];
    const next = before === n ? null : n;
    setValues((v) => ({ ...v, [field]: next }));
    start(async () => {
      const r = await saveCheckinField(ownerId, date, field, next);
      if (r.error) {
        setValues((v) => ({ ...v, [field]: before }));
        toast(r.error, { tone: "error" });
        return;
      }
      setSavedField(field);
      // The first answer of the day gets the full confirmation; later taps a quiet "Saved".
      if (!started && next !== null) {
        setStarted(true);
        toast("Check-in saved", { kind: "checkin" });
      }
    });
  }

  if (!canWrite && !checkin) {
    return <p className="text-sm text-fg-muted">You can see this check-in but not fill it in. They can allow it in Settings → Sharing → Daily check-in (Can edit).</p>;
  }

  return (
    <div className="space-y-3">
      {!canWrite ? <p className="text-xs text-fg-muted">View only: they haven&apos;t let you edit their check-in.</p> : null}
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
                onClick={() => tap(s.field, n)}
                className={cx(
                  "pressable h-8 flex-1 rounded-lg text-sm tabular-nums transition",
                  values[s.field] === n ? "fx-pop bg-accent font-semibold text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <span aria-hidden className="text-sm">{s.high}</span>
          <span className={cx("w-4 text-xs text-accent transition-opacity", savedField === s.field ? "opacity-100" : "opacity-0")} aria-hidden>
            ✓
          </span>
        </div>
      ))}
      {!compact ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            start(async () => {
              const a = await saveCheckinField(ownerId, date, "sleep_hours", hours === "" ? null : Number(hours));
              const b = a.error ? a : await saveCheckinField(ownerId, date, "notes", notes);
              setSaving(false);
              if (b.error) return toast(b.error, { tone: "error" });
              setStarted(true);
              toast(hours ? `Check-in saved · slept ${hours} h` : "Check-in saved", { kind: "checkin" });
            });
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-16 text-sm font-medium">Slept</span>
            <Input type="number" inputMode="decimal" min={0} max={24} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} className="w-24" disabled={!canWrite} aria-label="Hours slept" />
            <span className="text-sm text-fg-muted">hours</span>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Anything notable today? (period, travel, illness…)" disabled={!canWrite} className="min-h-14" />
          {canWrite ? (
            <Button type="submit" size="sm" variant="secondary" pending={saving}>Save sleep & notes</Button>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
