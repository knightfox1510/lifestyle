"use client";

import { useActionState, useState } from "react";
import { Card, Checkbox, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { addWatchItem } from "./actions";

export function AddWatchForm() {
  const [state, action] = useActionState(addWatchItem, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">
        + Add a show or movie
      </button>
    );
  }
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <Field label="Title" className="sm:col-span-2"><Input name="title" required maxLength={150} placeholder="The Office" /></Field>
        <Field label="Type">
          <Select name="kind" defaultValue="series">
            <option value="series">Series</option>
            <option value="movie">Movie</option>
            <option value="documentary">Documentary</option>
            <option value="anime">Anime</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Where"><Input name="platform" maxLength={60} placeholder="Netflix, JioHotstar, Prime…" /></Field>
        <Field label="Status">
          <Select name="status" defaultValue="want">
            <option value="want">Want to watch</option>
            <option value="watching">Watching</option>
          </Select>
        </Field>
        <Field label="Seasons"><Input name="total_seasons" type="number" min={1} max={100} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Input name="notes" maxLength={500} placeholder="Recommended by…" /></Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
          <Checkbox name="together" defaultChecked label="We watch this together" />
          <SubmitButton>Add</SubmitButton>
          <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>Close</button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
