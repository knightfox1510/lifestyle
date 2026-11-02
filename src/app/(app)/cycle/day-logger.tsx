"use client";

import { useState, useTransition } from "react";
import { Button, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { FLOWS, FLOW_LABEL, SYMPTOMS, SYMPTOM_LABEL, type Flow, type Symptom } from "@/modules/cycle/logic";
import { periodStarted, saveCycleDay } from "./actions";

const FLOW_DOTS: Record<Flow, string> = { spotting: "•", light: "💧", medium: "💧💧", heavy: "💧💧💧" };

/** Flow, symptoms and a note for one day; saves with one tap. */
export function DayLogger({ ownerId, day, initial }: { ownerId: string; day: string; initial: { flow: Flow | null; symptoms: string[]; notes: string | null } }) {
  const { toast } = useToast();
  const [flow, setFlow] = useState<Flow | null>(initial.flow);
  const [symptoms, setSymptoms] = useState<string[]>(initial.symptoms);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [pending, start] = useTransition();
  const dirty = flow !== initial.flow || notes !== (initial.notes ?? "") || symptoms.slice().sort().join() !== initial.symptoms.slice().sort().join();

  const save = () =>
    start(async () => {
      const r = await saveCycleDay(ownerId, { day, flow, symptoms, notes: notes || null });
      toast(r.error ?? "Saved.", r.error ? { tone: "error" } : undefined);
    });

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-fg-muted">Bleeding</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setFlow(null)} aria-pressed={!flow} className={cx("rounded-full border px-3 py-1.5 text-sm", !flow ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
            None
          </button>
          {FLOWS.map((f) => (
            <button key={f} type="button" onClick={() => setFlow(f)} aria-pressed={flow === f} className={cx("rounded-full border px-3 py-1.5 text-sm", flow === f ? "border-danger bg-danger-soft font-medium" : "border-border text-fg-muted")}>
              <span aria-hidden className="mr-1">{FLOW_DOTS[f]}</span>
              {FLOW_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-fg-muted">How you feel</p>
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s);
            return (
              <button key={s} type="button" onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])} aria-pressed={on} className={cx("rounded-full border px-3 py-1 text-xs", on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
                {SYMPTOM_LABEL[s as Symptom]}
              </button>
            );
          })}
        </div>
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Notes (optional)" className="min-h-12" />
      <Button onClick={save} disabled={pending || !dirty}>{pending ? "Saving…" : "Save day"}</Button>
    </div>
  );
}

export function PeriodStartedButton({ ownerId, day, label }: { ownerId: string; day: string; label: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await periodStarted(ownerId, day); toast(r.error ?? "Logged. Add how heavy it is below.", r.error ? { tone: "error" } : undefined); })}>
      🩸 {pending ? "…" : label}
    </Button>
  );
}
