"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Field, Input } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { LabResult } from "@/lib/types";
import { deleteLabResult, updateLabResult } from "../actions";
import { ConfirmDelete } from "../record-actions";

/** Fix a lab value (e.g. one AI misread from a report) or delete it. */
export function LabRowActions({ result, ownerId, canDelete }: { result: LabResult; ownerId: string; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof updateLabResult>> | null, form: FormData) => {
    const r = await updateLabResult(prev, form);
    if (r.ok) setEditing(false);
    return r;
  }, null);
  if (!editing) {
    return (
      <span className="flex items-center gap-1">
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-2" aria-label={`Edit ${result.marker}`}>
          <Pencil className="size-3.5" aria-hidden /> Edit
        </button>
        {canDelete ? <ConfirmDelete compact what={`${result.marker} on ${result.test_date}`} onDelete={() => deleteLabResult(result.id, ownerId)} /> : null}
      </span>
    );
  }
  return (
    <form action={action} className="grid w-full basis-full gap-2 rounded-xl border border-border p-3 sm:grid-cols-3">
      <input type="hidden" name="id" value={result.id} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="panel" value={result.panel ?? ""} />
      <Field label="Test" className="sm:col-span-2">
        <Input name="marker" required maxLength={120} defaultValue={result.marker} />
      </Field>
      <Field label="Date">
        <Input type="date" name="test_date" required defaultValue={result.test_date} />
      </Field>
      <Field label="Value">
        <Input name="value" type="number" step="any" defaultValue={result.value ?? ""} />
      </Field>
      <Field label="…or text (e.g. Negative)">
        <Input name="value_text" maxLength={120} defaultValue={result.value_text ?? ""} />
      </Field>
      <Field label="Unit">
        <Input name="unit" maxLength={40} defaultValue={result.unit ?? ""} />
      </Field>
      <Field label="Normal from">
        <Input name="ref_low" type="number" step="any" defaultValue={result.ref_low ?? ""} />
      </Field>
      <Field label="Normal up to">
        <Input name="ref_high" type="number" step="any" defaultValue={result.ref_high ?? ""} />
      </Field>
      <div className="flex items-end gap-2">
        <SubmitButton>Save</SubmitButton>
        <button type="button" onClick={() => setEditing(false)} className="h-10 px-3 text-sm text-fg-muted">Cancel</button>
      </div>
      <div className="sm:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
