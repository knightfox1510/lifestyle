"use client";

import { useActionState, useState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { VAULT_DOC_TYPES } from "@/lib/types";
import { DOC_LABEL } from "./labels";
import { saveDocument } from "./actions";

export function DocForm() {
  const [state, action] = useActionState(saveDocument, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">
        + Add a document
      </button>
    );
  }
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <Field label="Title" className="sm:col-span-2"><Input name="title" required maxLength={120} placeholder="Passport, Gaurav" /></Field>
        <Field label="Type">
          <Select name="doc_type" defaultValue="passport">
            {VAULT_DOC_TYPES.map((t) => (
              <option key={t} value={t}>{DOC_LABEL[t]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Visible to">
          <Select name="scope" defaultValue="personal">
            <option value="personal">Me (share in Settings)</option>
            <option value="household">Whole household</option>
          </Select>
        </Field>
        <Field label="Holder"><Input name="holder" maxLength={80} /></Field>
        <Field label="Last 4 of number" hint="Never the full number"><Input name="number_last4" maxLength={30} placeholder="1234" /></Field>
        <Field label="Issued"><Input name="issued_on" type="date" /></Field>
        <Field label="Expires"><Input name="expires_on" type="date" /></Field>
        <Field label="Remind days before"><Input name="remind_days_before" type="number" min={0} max={365} defaultValue={60} /></Field>
        <Field label="Notes" className="sm:col-span-3"><Input name="notes" maxLength={500} placeholder="Where it's kept, renewal steps…" /></Field>
        <div className="flex items-center gap-2 sm:col-span-4">
          <SubmitButton>Save</SubmitButton>
          <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>Close</button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
