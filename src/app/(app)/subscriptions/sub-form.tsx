"use client";

import { useActionState, useState } from "react";
import { Card, Checkbox, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { BILLING_CYCLES, SUB_CATEGORIES } from "@/lib/types";
import { addSubscription } from "./actions";

export function SubForm({ members }: { members: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addSubscription, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">
        + Add a subscription
      </button>
    );
  }
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <Field label="Service" className="sm:col-span-2"><Input name="name" required maxLength={80} placeholder="Netflix" /></Field>
        <Field label="Category">
          <Select name="category" defaultValue="streaming">
            {SUB_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Billing">
          <Select name="billing_cycle" defaultValue="monthly">
            {BILLING_CYCLES.map((c) => (
              <option key={c} value={c}>{c.replace("_", "-")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cost"><Input name="cost" type="number" min={0} step="any" /></Field>
        <Field label="Currency"><Input name="currency" defaultValue="INR" maxLength={3} /></Field>
        <Field label="Next renewal"><Input name="next_renewal_on" type="date" /></Field>
        <Field label="Paid by">
          <Select name="paid_by" defaultValue="">
            <option value="">–</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Link" className="sm:col-span-2"><Input name="url" type="url" placeholder="https://" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Input name="notes" maxLength={300} placeholder="Login is on Karishma's phone" /></Field>
        <div className="flex items-center gap-3 sm:col-span-4">
          <Checkbox name="auto_renew" defaultChecked label="Auto-renews" />
          <SubmitButton>Add</SubmitButton>
          <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>Close</button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
