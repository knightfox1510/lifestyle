"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { WORKOUT_KINDS, type FitnessClass } from "@/lib/types";
import { DAY_LETTERS } from "@/modules/medicines/logic";
import { KIND_META } from "@/modules/fitness/meta";
import { logWorkout, markClass, saveClass } from "./actions";

export function ClassButtons({ classId, ownerId, date, status }: { classId: string; ownerId: string; date: string; status: "done" | "skipped" | null }) {
  const [pending, start] = useTransition();
  const set = (s: "done" | "skipped" | null) => start(async () => void (await markClass(classId, ownerId, date, s)));
  if (status) {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => set(null)}>
        Undo
      </Button>
    );
  }
  return (
    <div className="flex gap-1">
      <Button size="sm" disabled={pending} onClick={() => set("done")}>Done</Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => set("skipped")}>Skipped</Button>
    </div>
  );
}

export function WorkoutForm({ ownerId, today }: { ownerId: string; today: string }) {
  const [state, action] = useActionState(logWorkout, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">
        + Log a workout (walk, run, home session…)
      </button>
    );
  }
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-6">
        <input type="hidden" name="ownerId" value={ownerId} />
        <Field label="Type">
          <Select name="kind" defaultValue="walk">
            {WORKOUT_KINDS.map((k) => (
              <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}</option>
            ))}
          </Select>
        </Field>
        <Field label="What" className="sm:col-span-2">
          <Input name="title" required maxLength={100} placeholder="Evening walk" />
        </Field>
        <Field label="Date">
          <Input type="date" name="performed_on" defaultValue={today} max={today} required />
        </Field>
        <Field label="Minutes">
          <Input type="number" name="duration_minutes" min={1} max={600} />
        </Field>
        <Field label="Effort (1–5)">
          <Input type="number" name="intensity" min={1} max={5} />
        </Field>
        <Field label="Notes" className="sm:col-span-6">
          <Textarea name="notes" maxLength={500} className="min-h-10" placeholder="e.g. avoided jumping moves; felt fine" />
        </Field>
        <div className="flex items-center gap-2 sm:col-span-6">
          <SubmitButton>Log workout</SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}

export function ClassForm({ ownerId, cls, onDone }: { ownerId: string; cls?: FitnessClass; onDone?: () => void }) {
  const [state, action] = useActionState(async (p: Awaited<ReturnType<typeof saveClass>> | null, f: FormData) => {
    const r = await saveClass(p, f);
    if (r.ok) onDone?.();
    return r;
  }, null);
  const [days, setDays] = useState<number[]>(cls?.days_of_week ?? [1, 3, 5]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="id" value={cls?.id ?? ""} />
      {days.map((d) => (
        <input key={d} type="hidden" name="days_of_week" value={d} />
      ))}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Class" className="sm:col-span-2">
          <Input name="name" required maxLength={100} defaultValue={cls?.name} placeholder="Morning gym" />
        </Field>
        <Field label="Type">
          <Select name="kind" defaultValue={cls?.kind ?? "gym"}>
            {WORKOUT_KINDS.map((k) => (
              <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Starts">
          <Input type="time" name="start_time" required defaultValue={cls?.start_time ?? "07:30"} />
        </Field>
        <Field label="Minutes">
          <Input type="number" name="duration_minutes" min={5} max={480} defaultValue={cls?.duration_minutes ?? 60} />
        </Field>
        <Field label="Remind me (min before)">
          <Select name="remind_minutes_before" defaultValue={String(cls?.remind_minutes_before ?? 60)}>
            <option value="">No reminder</option>
            {[10, 15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </Select>
        </Field>
        <Field label="Where">
          <Input name="location" maxLength={120} defaultValue={cls?.location ?? ""} />
        </Field>
        <Field label="Instructor">
          <Input name="instructor" maxLength={120} defaultValue={cls?.instructor ?? ""} />
        </Field>
      </div>
      <div className="flex gap-1" role="group" aria-label="Days">
        {DAY_LETTERS.map((l, d) => (
          <button
            key={d}
            type="button"
            aria-pressed={days.includes(d)}
            onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
            className={cx("size-9 rounded-full text-sm", days.includes(d) ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted")}
          >
            {l}
          </button>
        ))}
      </div>
      <ActionMessage state={state} />
      <SubmitButton>{cls ? "Save" : "Add class"}</SubmitButton>
    </form>
  );
}
