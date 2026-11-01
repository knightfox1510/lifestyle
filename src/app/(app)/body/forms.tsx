"use client";

import { useActionState, useState } from "react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { BodyGoals } from "@/lib/types";
import { logBodyMetric, saveBodyGoals } from "./actions";

export function WeightForm({ ownerId, last }: { ownerId: string; last: number | null }) {
  const [state, action] = useActionState(logBodyMetric, null);
  const [more, setMore] = useState(false);
  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="ownerId" value={ownerId} />
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Weight (kg)" className="w-32">
            <Input name="weight_kg" type="number" step="0.1" min={20} max={350} placeholder={last ? String(last) : "e.g. 64.5"} />
          </Field>
          <Field label="Body fat %" className="w-28">
            <Input name="body_fat_pct" type="number" step="0.1" min={2} max={75} />
          </Field>
          <SubmitButton>Log</SubmitButton>
          <button type="button" className="h-10 text-sm text-fg-muted hover:text-fg" onClick={() => setMore(!more)}>
            {more ? "− fewer" : "+ measurements"}
          </button>
        </div>
        {more ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["waist_cm", "Waist cm"],
              ["hip_cm", "Hip cm"],
              ["chest_cm", "Chest cm"],
              ["arm_cm", "Arm cm"],
              ["thigh_cm", "Thigh cm"],
            ].map(([n, l]) => (
              <Field key={n} label={l}>
                <Input name={n} type="number" step="0.1" min={10} max={250} />
              </Field>
            ))}
          </div>
        ) : null}
        <ActionMessage state={state} />
      </form>
    </Card>
  );
}

export function VitalsForm({ ownerId }: { ownerId: string }) {
  const [state, action] = useActionState(logBodyMetric, null);
  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="ownerId" value={ownerId} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="BP systolic">
            <Input name="bp_systolic" type="number" min={60} max={260} placeholder="120" />
          </Field>
          <Field label="BP diastolic">
            <Input name="bp_diastolic" type="number" min={30} max={160} placeholder="80" />
          </Field>
          <Field label="Resting HR">
            <Input name="resting_hr" type="number" min={25} max={220} placeholder="bpm" />
          </Field>
          <Field label="Glucose mg/dL">
            <Input name="blood_glucose_mgdl" type="number" min={20} max={600} />
          </Field>
          <Field label="Glucose timing">
            <Select name="glucose_context" defaultValue="fasting">
              <option value="fasting">Fasting</option>
              <option value="post_meal">After a meal</option>
              <option value="random">Random</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea name="notes" maxLength={500} className="min-h-10" />
        </Field>
        <ActionMessage state={state} />
        <SubmitButton>Save vitals</SubmitButton>
      </form>
    </Card>
  );
}

export function BodyGoalsForm({ ownerId, goals, current }: { ownerId: string; goals: BodyGoals | null; current: number | null }) {
  const [state, action] = useActionState(saveBodyGoals, null);
  const [open, setOpen] = useState(!goals);
  const [start, setStart] = useState(goals?.start_weight_kg?.toString() ?? current?.toString() ?? "");
  const [target, setTarget] = useState(goals?.target_weight_kg?.toString() ?? "");
  const [milestones, setMilestones] = useState(goals?.milestones.join(", ") ?? "");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-fg-muted hover:text-fg">
        ✎ Edit goal & milestones
      </button>
    );
  }
  const everyKg = () => {
    const a = Number(start);
    const b = Number(target);
    if (!a || !b || a === b) return;
    const step = a > b ? -1 : 1;
    const list: number[] = [];
    for (let w = Math.round(a) + step; step < 0 ? w > b : w < b; w += step) list.push(w);
    setMilestones(list.slice(0, 20).join(", "));
  };
  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="ownerId" value={ownerId} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Start weight kg">
            <Input name="start_weight_kg" type="number" step="0.1" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Target weight kg">
            <Input name="target_weight_kg" type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="60" />
          </Field>
          <Field label="By (optional)">
            <Input name="target_date" type="date" defaultValue={goals?.target_date ?? ""} />
          </Field>
          <Field label="Target body fat %">
            <Input name="target_body_fat_pct" type="number" step="0.1" defaultValue={goals?.target_body_fat_pct ?? ""} />
          </Field>
        </div>
        <Field label="Milestones (kg)" hint={<button type="button" className="underline" onClick={everyKg}>Fill every 1 kg</button>}>
          <Input name="milestones" value={milestones} onChange={(e) => setMilestones(e.target.value)} placeholder="63, 62, 61" />
        </Field>
        <ActionMessage state={state} />
        <div className="flex gap-2">
          <SubmitButton>Save goal</SubmitButton>
          {goals ? <button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-fg-muted">Close</button> : null}
        </div>
      </form>
    </Card>
  );
}
