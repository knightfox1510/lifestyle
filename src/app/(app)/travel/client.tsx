"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Checkbox, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { TripPlan } from "@/lib/ai/phase2-schemas";
import { TRIP_ITEM_KINDS, type PackingItem } from "@/lib/types";
import { ITEM_META } from "@/modules/travel/templates";
import { addPacking, addTrip, addTripItem, applyTemplate, importPlan, togglePacked, updatePacking } from "./actions";
import { EditRecord } from "@/components/edit-record";

export function AddTripForm() {
  const router = useRouter();
  const [state, action] = useActionState(addTrip, null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state?.id) router.push(`/travel/${state.id}`);
  }, [state, router]);
  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">+ New trip or idea</button>;
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <Field label="Trip" className="sm:col-span-2"><Input name="title" required maxLength={120} placeholder="Japan spring 2027" /></Field>
        <Field label="Destination" className="sm:col-span-2"><Input name="destination" maxLength={120} placeholder="Tokyo, Kyoto, Osaka" /></Field>
        <Field label="From"><Input name="start_date" type="date" /></Field>
        <Field label="To"><Input name="end_date" type="date" /></Field>
        <Field label="Stage">
          <Select name="status" defaultValue="idea">
            <option value="idea">Just an idea</option>
            <option value="planning">Planning</option>
            <option value="booked">Booked</option>
          </Select>
        </Field>
        <Field label="Budget"><Input name="budget" type="number" min={0} /></Field>
        <input type="hidden" name="currency" value="INR" />
        <div className="flex items-center gap-2 sm:col-span-4">
          <SubmitButton>Create</SubmitButton>
          <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>Close</button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}

export function TripItemForm({ tripId, days }: { tripId: string; days: string[] }) {
  const [state, action] = useActionState(addTripItem, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-6 sm:items-end">
      <input type="hidden" name="tripId" value={tripId} />
      <Field label="Type">
        <Select name="kind" defaultValue="activity">
          {TRIP_ITEM_KINDS.map((k) => (
            <option key={k} value={k}>{ITEM_META[k].icon} {ITEM_META[k].label}</option>
          ))}
        </Select>
      </Field>
      <Field label="What" className="sm:col-span-2"><Input name="title" required maxLength={200} placeholder="teamLab Planets" /></Field>
      <Field label="Day">
        {days.length ? (
          <Select name="day_date" defaultValue="">
            <option value="">Unscheduled</option>
            {days.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        ) : (
          <Input name="day_date" type="date" />
        )}
      </Field>
      <Field label="Time"><Input name="start_time" type="time" /></Field>
      <Field label="Cost"><Input name="cost" type="number" min={0} /></Field>
      <Field label="Link" className="sm:col-span-3"><Input name="url" type="url" placeholder="https://" /></Field>
      <Field label="Where" className="sm:col-span-3"><Input name="location" maxLength={200} /></Field>
      <div className="flex items-center gap-2 sm:col-span-6">
        <SubmitButton size="sm">Add</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function PackingList({ tripId, items, members, templates }: { tripId: string; items: PackingItem[]; members: { id: string; name: string }[]; templates: { key: string; name: string }[] }) {
  const [, start] = useTransition();
  const [state, action] = useActionState(addPacking, null);
  const [msg, setMsg] = useState<string | null>(null);
  const [list, setPacked] = useOptimistic(items, (s, c: { id: string; packed: boolean }) => s.map((i) => (i.id === c.id ? { ...i, packed: c.packed } : i)));
  const categories = [...new Set(list.map((i) => i.category))].sort();
  const packed = list.filter((i) => i.packed).length;
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{packed}/{list.length} packed</span>
        <Select
          className="!h-8 w-56"
          defaultValue=""
          aria-label="Add from template"
          onChange={(e) => {
            const key = e.target.value;
            e.target.value = "";
            if (key) start(async () => { const r = await applyTemplate(tripId, key); setMsg(r.error ?? r.message ?? null); });
          }}
        >
          <option value="">+ Add from a template…</option>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>{t.name}</option>
          ))}
        </Select>
      </div>
      {list.length ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${(packed / list.length) * 100}%` }} /></div>
      ) : null}
      {msg ? <Notice>{msg}</Notice> : null}
      {categories.map((c) => (
        <div key={c}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{c}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {list.filter((i) => i.category === c).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  aria-pressed={i.packed}
                  onClick={() => start(async () => { setPacked({ id: i.id, packed: !i.packed }); await togglePacked(i.id, !i.packed); })}
                  className={cx("flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm", i.packed ? "border-accent/40 bg-accent-soft text-fg-muted line-through" : "border-border hover:bg-surface-2")}
                >
                  <span aria-hidden>{i.packed ? "✓" : "○"}</span>
                  <span className="flex-1">{i.name}{i.qty > 1 ? ` ×${i.qty}` : ""}</span>
                  {i.for_user ? <span className="text-xs text-fg-muted">{nameOf(i.for_user)}</span> : null}
                </button>
                <EditRecord
                  fields={[
                    { name: "name", label: "Item", type: "text", maxLength: 120 },
                    { name: "category", label: "Category", type: "text", maxLength: 40 },
                    { name: "qty", label: "How many", type: "number", min: 1, max: 99, step: 1 },
                    { name: "for_user", label: "For", type: "select", allowEmpty: true, options: members.map((m) => ({ value: m.id, label: m.name })) },
                  ]}
                  values={{ name: i.name, category: i.category, qty: i.qty, for_user: i.for_user }}
                  onSave={updatePacking.bind(null, i.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tripId" value={tripId} />
        <Field label="Item" className="min-w-36 flex-1"><Input name="name" required maxLength={120} /></Field>
        <Field label="Category" className="w-32"><Input name="category" maxLength={40} placeholder="clothes" list="pack-cats" /></Field>
        <datalist id="pack-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="For" className="w-32">
          <Select name="for_user" defaultValue="">
            <option value="">Shared</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
        <SubmitButton variant="secondary">Add</SubmitButton>
        <ActionMessage state={state} />
      </form>
    </div>
  );
}

export function TripPlanner({ tripId, defaultUseHealth }: { tripId: string; defaultUseHealth: boolean }) {
  const [notes, setNotes] = useState("");
  const [useHealth, setUseHealth] = useState(defaultUseHealth);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [parts, setParts] = useState({ itinerary: true, packing: true });
  const [pending, start] = useTransition();

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/trip-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId, notes: notes || undefined, useMedicalHistory: useHealth }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Planning failed");
      setPlan(body);
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">✨ Plan with AI</h2>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={600} className="min-h-12" placeholder="e.g. relaxed pace, food markets, one day trip to Nara, I'm bringing the drone" />
      <Checkbox checked={useHealth} onChange={(e) => setUseHealth(e.target.checked)} label="Consider health needs (medicines, diet, comfort)" />
      <Button onClick={run} disabled={loading}>{loading ? "Planning…" : "Suggest itinerary & packing list"}</Button>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {plan ? (
        <div className="space-y-3 rounded-xl border border-border p-3 text-sm">
          {plan.days.map((d, i) => (
            <div key={i}>
              <p className="font-medium">{d.date ?? `Day ${i + 1}`}: {d.title}</p>
              <ul className="ml-4 list-disc text-fg-muted">
                {d.items.map((it, j) => (
                  <li key={j}>{it.time ? `${it.time} ` : ""}{it.title}{it.location ? ` · ${it.location}` : ""}</li>
                ))}
              </ul>
            </div>
          ))}
          {plan.packing.length ? <p><strong>Packing:</strong> {plan.packing.map((p) => p.name).join(", ")}</p> : null}
          {plan.tips.length ? (
            <ul className="ml-4 list-disc">{plan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox checked={parts.itinerary} onChange={(e) => setParts({ ...parts, itinerary: e.target.checked })} label="Itinerary" />
            <Checkbox checked={parts.packing} onChange={(e) => setParts({ ...parts, packing: e.target.checked })} label="Packing list" />
            <Button size="sm" disabled={pending || (!parts.itinerary && !parts.packing)} onClick={() => start(async () => {
              const r = await importPlan(tripId, plan, parts);
              setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Added." });
              if (!r.error) setPlan(null);
            })}>Add to trip</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
