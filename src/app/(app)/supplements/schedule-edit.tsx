"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { FrequencyPicker, repeatColumns, type FrequencyValue } from "@/components/frequency-picker";
import { frequencyOf } from "@/modules/schedule";
import { setSupplementSchedule } from "./actions";

/** Change how often a supplement is taken. */
export function SupplementScheduleEdit({ id, ownerId, daysOfWeek, every, start, today }: { id: string; ownerId: string; daysOfWeek: number[] | null; every: number | null; start: string | null; today: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [freq, setFreq] = useState<FrequencyValue>(() => ({ frequency: frequencyOf({ days_of_week: daysOfWeek, repeat_every_days: every }), days: daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6], every: every ?? 14 }));
  const [from, setFrom] = useState(start ?? today);
  const [pending, run] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="How often" title="How often">
        <CalendarClock className="size-3.5" aria-hidden />
      </button>
    );
  }
  return (
    <div className="mt-2 w-full space-y-2 rounded-xl border border-border bg-surface-2/40 p-3">
      <FrequencyPicker value={freq} onChange={setFreq} startLabel="the first day below" />
      {freq.frequency === "every_n" ? (
        <Field label="First day" className="w-44">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
      ) : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const c = repeatColumns(freq);
              const r = await setSupplementSchedule(id, ownerId, { days_of_week: c.days_of_week ?? [], repeat_every_days: c.repeat_every_days, schedule_start: freq.frequency === "every_n" ? from : null });
              toast(r.error ?? r.message ?? "Saved.", r.error ? { tone: "error" } : undefined);
              if (!r.error) setOpen(false);
            })
          }
        >
          {pending ? "…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
