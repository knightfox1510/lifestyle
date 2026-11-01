"use client";

import { useActionState, useState } from "react";
import { Card, Checkbox, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { addGift, addOccasion } from "./actions";

export function OccasionForm() {
  const [state, action] = useActionState(addOccasion, null);
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">+ Add a date</button>;
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <Field label="What" className="sm:col-span-2"><Input name="title" required maxLength={120} placeholder="Karishma's birthday" /></Field>
        <Field label="Type">
          <Select name="kind" defaultValue="birthday">
            <option value="birthday">Birthday</option>
            <option value="anniversary">Anniversary</option>
            <option value="festival">Festival</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Date"><Input name="date" type="date" required /></Field>
        <Field label="Person"><Input name="person" maxLength={80} /></Field>
        <Field label="Remind days before"><Input name="remind_days_before" type="number" min={0} max={60} defaultValue={7} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Input name="notes" maxLength={500} /></Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-4">
          <Checkbox name="recurring" defaultChecked label="Every year" />
          <Checkbox name="year_known" defaultChecked label="Year is correct (to show age / years)" />
          <SubmitButton>Save</SubmitButton>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}

export function GiftForm({ occasions }: { occasions: { id: string; title: string; person: string | null }[] }) {
  const [state, action] = useActionState(addGift, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-6 sm:items-end">
      <Field label="For"><Input name="for_person" required maxLength={80} list="gift-people" /></Field>
      <datalist id="gift-people">{[...new Set(occasions.map((o) => o.person).filter(Boolean))].map((p) => <option key={p!} value={p!} />)}</datalist>
      <Field label="Idea" className="sm:col-span-2"><Input name="idea" required maxLength={200} placeholder="Kindle Paperwhite" /></Field>
      <Field label="Occasion">
        <Select name="occasion_id" defaultValue="">
          <option value="">Any time</option>
          {occasions.map((o) => (
            <option key={o.id} value={o.id}>{o.title}</option>
          ))}
        </Select>
      </Field>
      <Field label="₹"><Input name="price" type="number" min={0} /></Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <Field label="Link" className="sm:col-span-6"><Input name="url" type="url" placeholder="https://" /></Field>
      <div className="sm:col-span-6"><ActionMessage state={state} /></div>
    </form>
  );
}
