"use client";

import { useActionState, useState } from "react";
import { Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { CATEGORY_META } from "@/modules/medical/meta";
import { MEDICAL_CATEGORIES, type MedicalCategory } from "@/lib/types";
import { addMedicalEvent } from "./actions";

export function AddEventForm({ ownerId, relatable }: { ownerId: string; relatable: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<MedicalCategory>("illness");
  const [ongoing, setOngoing] = useState(false);
  // React resets uncontrolled fields after a successful action; reset the controlled one here.
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof addMedicalEvent>> | null, form: FormData) => {
    const result = await addMedicalEvent(prev, form);
    if (result.ok) setOngoing(false);
    return result;
  }, null);
  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface"
      >
        + Add to timeline: a cold, surgery, medicine taken, allergy, test result…
      </button>
    );
  }

  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="ownerId" value={ownerId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select name="category" value={category} onChange={(e) => setCategory(e.target.value as MedicalCategory)}>
              {MEDICAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={category === "medication" ? "Medicine name" : "What happened"}>
            <Input
              name="title"
              required
              maxLength={200}
              placeholder={category === "medication" ? "e.g. Azithromycin 500mg" : "e.g. Cough and cold"}
            />
          </Field>
          <Field label="Start date">
            <Input type="date" name="start_date" required defaultValue={today} max={today} />
          </Field>
          <Field label="End date">
            <Input type="date" name="end_date" disabled={ongoing} />
          </Field>
        </div>

        {category === "medication" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Dose">
              <Input name="dosage" maxLength={120} placeholder="1 tablet / 5 ml" />
            </Field>
            <Field label="How often">
              <Input name="frequency" maxLength={120} placeholder="Twice daily after food" />
            </Field>
            <Field label="Taken for">
              <Select name="related_event_id" defaultValue="">
                <option value="">Not linked</option>
                {relatable.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <Field label="Severity">
            <Select name="severity" defaultValue="">
              <option value="">Not specified</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </Select>
          </Field>
        )}

        <Field label="Notes">
          <Textarea name="details" maxLength={4000} placeholder="Symptoms, doctor, hospital, what helped…" />
        </Field>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox name="ongoing" label="Still ongoing" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
          <Checkbox name="include_in_ai" label="Use in AI suggestions" defaultChecked />
        </div>
        <ActionMessage state={state} />
        <div className="flex gap-2">
          <SubmitButton>Add entry</SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 text-sm text-fg-muted hover:bg-surface-2">
            Close
          </button>
        </div>
      </form>
    </Card>
  );
}
