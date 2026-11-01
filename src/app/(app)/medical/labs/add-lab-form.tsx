"use client";

import { useActionState, useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { COMMON_MARKERS } from "@/modules/medical/labs";
import { addLabResult } from "../actions";

export function AddLabForm({ ownerId }: { ownerId: string }) {
  const [open, setOpen] = useState(false);
  const [marker, setMarker] = useState("");
  const [state, action] = useActionState(addLabResult, null);
  const known = COMMON_MARKERS.find((m) => m.marker.toLowerCase() === marker.trim().toLowerCase());
  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">
        + Add a result by hand
      </button>
    );
  }
  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="ownerId" value={ownerId} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Test" className="sm:col-span-2">
            <Input name="marker" list="lab-markers" required maxLength={120} value={marker} onChange={(e) => setMarker(e.target.value)} placeholder="e.g. Vitamin D (25-OH)" />
            <datalist id="lab-markers">
              {COMMON_MARKERS.map((m) => (
                <option key={m.marker} value={m.marker} />
              ))}
            </datalist>
          </Field>
          <Field label="Date">
            <Input type="date" name="test_date" required defaultValue={today} max={today} />
          </Field>
          <Field label="Value">
            <Input name="value" type="number" step="any" placeholder="numeric" />
          </Field>
          <Field label="Unit">
            <Input key={`u-${known?.marker}`} name="unit" maxLength={40} defaultValue={known?.unit ?? ""} />
          </Field>
          <Field label="Panel">
            <Input key={`p-${known?.marker}`} name="panel" maxLength={100} defaultValue={known?.panel ?? ""} placeholder="e.g. Lipid profile" />
          </Field>
          <Field label="Ref. low">
            <Input key={`l-${known?.marker}`} name="ref_low" type="number" step="any" defaultValue={known?.low ?? ""} />
          </Field>
          <Field label="Ref. high">
            <Input key={`h-${known?.marker}`} name="ref_high" type="number" step="any" defaultValue={known?.high ?? ""} />
          </Field>
          <Field label="Or text result">
            <Input name="value_text" maxLength={120} placeholder="e.g. Negative" />
          </Field>
        </div>
        <p className="text-xs text-fg-muted">Use the reference range printed on your report; the suggested ones are typical adult values.</p>
        <ActionMessage state={state} />
        <div className="flex gap-2">
          <SubmitButton>Add result</SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </form>
    </Card>
  );
}
