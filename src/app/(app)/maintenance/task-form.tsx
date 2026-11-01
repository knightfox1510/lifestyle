"use client";

import { useActionState, useState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { saveTask } from "./actions";

export function TaskForm() {
  const [state, action] = useActionState(saveTask, null);
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-fg-muted hover:text-fg">+ Add a custom task</button>;
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <Field label="Task" className="sm:col-span-2"><Input name="title" required maxLength={120} /></Field>
        <Field label="Category">
          <Select name="category" defaultValue="home">
            {["appliance", "vehicle", "home", "insurance", "health", "other"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Repeat every (days)"><Input name="interval_days" type="number" min={1} max={3650} placeholder="e.g. 90" /></Field>
        <Field label="Last done"><Input name="last_done_on" type="date" /></Field>
        <Field label="Next due" hint="Calculated from last done if empty"><Input name="next_due_on" type="date" /></Field>
        <Field label="Remind days before"><Input name="remind_days_before" type="number" min={0} max={120} defaultValue={7} /></Field>
        <Field label="Vendor / contact"><Input name="vendor" maxLength={120} /></Field>
        <div className="flex items-center gap-2 sm:col-span-4">
          <SubmitButton>Add task</SubmitButton>
          <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>Close</button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
