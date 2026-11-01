"use client";

import { useActionState, useState } from "react";
import { Button, Card, Checkbox, Field, Input, Notice, Select, cx } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { LOG_META } from "@/modules/child/vaccines";
import type { CHILD_LOG_KINDS } from "@/lib/types";
import { addDependent, addGrowth, addVaccine, logChild } from "./actions";

type Kind = (typeof CHILD_LOG_KINDS)[number];

export function AddDependentForm({ first }: { first: boolean }) {
  const [state, action] = useActionState(addDependent, null);
  const [open, setOpen] = useState(first);
  const [kind, setKind] = useState<"child" | "pet">("child");
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-fg-muted hover:text-fg">+ Add another child</button>;
  return (
    <Card>
      <form action={action} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Name">
            <Input name="name" required maxLength={60} />
          </Field>
          <Field label="Child or pet">
            <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "child" | "pet")}>
              <option value="child">Child</option>
              <option value="pet">Pet</option>
            </Select>
          </Field>
          <Field label="Date of birth">
            <Input type="date" name="date_of_birth" />
          </Field>
          <Field label="Sex">
            <Select name="sex" defaultValue="">
              <option value="">–</option>
              <option value="male">Boy</option>
              <option value="female">Girl</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        {kind === "child" ? <Checkbox name="seed_vaccines" defaultChecked label="Add the IAP vaccination schedule (needs date of birth)" hint="You can tick off doses already given." /> : null}
        <ActionMessage state={state} />
        <SubmitButton>Add</SubmitButton>
      </form>
    </Card>
  );
}

export function ChildQuickLog({ dependentId, lastMedicine }: { dependentId: string; lastMedicine: { detail: string; ago: string; by: string } | null }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [state, action] = useActionState(async (p: Awaited<ReturnType<typeof logChild>> | null, f: FormData) => {
    const r = await logChild(p, f);
    if (r.ok) setKind(null);
    return r;
  }, null);
  const kinds: Kind[] = ["feed", "diaper", "medicine", "temperature", "milestone", "note"];
  return (
    <Card className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(kind === k ? null : k)}
            className={cx("flex flex-col items-center gap-0.5 rounded-xl border py-2 text-xs font-medium", kind === k ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2")}
          >
            <span className="text-xl" aria-hidden>{LOG_META[k].icon}</span>
            {LOG_META[k].label}
          </button>
        ))}
      </div>
      {kind ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="dependentId" value={dependentId} />
          <input type="hidden" name="kind" value={kind} />
          {kind === "medicine" && lastMedicine ? (
            <Notice tone="danger">⚠️ Last dose: <strong>{lastMedicine.detail}</strong> {lastMedicine.ago} ago by {lastMedicine.by}. Check the gap before giving more.</Notice>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {kind === "feed" ? (
              <>
                <Field label="Amount (ml)">
                  <Input name="amount_ml" type="number" min={0} max={2000} placeholder="optional" />
                </Field>
                <Field label="Type" className="sm:col-span-2">
                  <Input name="detail" maxLength={300} placeholder="Breastfeed left / formula / solids: dal rice" />
                </Field>
              </>
            ) : kind === "diaper" ? (
              <Field label="Type">
                <Select name="detail" defaultValue="wet">
                  <option value="wet">Wet</option>
                  <option value="dirty">Dirty</option>
                  <option value="wet + dirty">Wet + dirty</option>
                </Select>
              </Field>
            ) : kind === "temperature" ? (
              <>
                <Field label="°C">
                  <Input name="value" type="number" step="0.1" min={25} max={45} required />
                </Field>
                <Field label="Note" className="sm:col-span-2">
                  <Input name="detail" maxLength={300} placeholder="armpit / forehead…" />
                </Field>
              </>
            ) : (
              <Field label={kind === "medicine" ? "Medicine & dose" : kind === "milestone" ? "Milestone" : "Note"} className="sm:col-span-3">
                <Input name="detail" maxLength={300} required={kind !== "note"} placeholder={kind === "medicine" ? "Paracetamol drops 0.6 ml" : kind === "milestone" ? "First steps!" : ""} />
              </Field>
            )}
          </div>
          <div className="flex gap-2">
            <SubmitButton>Save {LOG_META[kind].label.toLowerCase()}</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setKind(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}
      <ActionMessage state={state} />
    </Card>
  );
}

export function VaccineForm({ dependentId }: { dependentId: string }) {
  const [state, action] = useActionState(addVaccine, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="dependentId" value={dependentId} />
      <Field label="Add vaccine" className="min-w-40 flex-1">
        <Input name="vaccine" required maxLength={120} />
      </Field>
      <Field label="Due">
        <Input name="due_on" type="date" />
      </Field>
      <SubmitButton variant="secondary">Add</SubmitButton>
      <div className="basis-full"><ActionMessage state={state} /></div>
    </form>
  );
}

export function GrowthForm({ dependentId, today }: { dependentId: string; today: string }) {
  const [state, action] = useActionState(addGrowth, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end">
      <input type="hidden" name="dependentId" value={dependentId} />
      <Field label="Date"><Input name="measured_on" type="date" defaultValue={today} max={today} required /></Field>
      <Field label="Weight kg"><Input name="weight_kg" type="number" step="0.01" min={0.3} max={200} /></Field>
      <Field label="Height cm"><Input name="height_cm" type="number" step="0.1" min={20} max={250} /></Field>
      <Field label="Head cm"><Input name="head_cm" type="number" step="0.1" min={20} max={70} /></Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <div className="col-span-2 sm:col-span-5"><ActionMessage state={state} /></div>
    </form>
  );
}
