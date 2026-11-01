"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card, Checkbox, Field, Input, Notice, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { OrderSuggestion } from "@/lib/ai/phase2-schemas";
import { addFoodItems } from "@/app/(app)/food/actions";
import { mealForHour } from "@/modules/food/meta";
import { addDish, addPlace, logOrder } from "./actions";

export function WhatToOrder({ members, me, defaultUseHealth, canLog }: { members: { id: string; name: string }[]; me: string; defaultUseHealth: boolean; canLog: boolean }) {
  const [people, setPeople] = useState<string[]>(members.map((m) => m.id));
  const [notes, setNotes] = useState("");
  const [budget, setBudget] = useState("");
  const [useHealth, setUseHealth] = useState(defaultUseHealth);
  const [result, setResult] = useState<OrderSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const myName = members.find((m) => m.id === me)?.name;

  async function ask() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/what-to-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people, notes: notes || undefined, budget: budget ? Number(budget) : null, useMedicalHistory: useHealth }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't get suggestions");
      setResult(body);
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">🍔 What should we order tonight?</h2>
      <div className="flex flex-wrap gap-3">
        {members.map((m) => (
          <Checkbox
            key={m.id}
            label={m.name}
            checked={people.includes(m.id)}
            onChange={(e) => setPeople(e.target.checked ? [...people, m.id] : people.filter((x) => x !== m.id))}
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} placeholder="Mood? e.g. something light, craving burgers, high protein" aria-label="Wishes" />
        <Input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" min={0} placeholder="Budget ₹ (optional)" aria-label="Budget" />
      </div>
      <Checkbox checked={useHealth} onChange={(e) => setUseHealth(e.target.checked)} label="Consider health data" />
      <Button onClick={ask} disabled={loading || !people.length}>{loading ? "Thinking…" : "✨ Suggest"}</Button>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {result ? (
        <div className="space-y-3">
          {result.options.map((o, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <p className="font-medium">{o.place}{o.total_estimate ? <span className="text-sm font-normal text-fg-muted"> · ~₹{Math.round(o.total_estimate)}</span> : null}</p>
              <p className="text-sm text-fg-muted">{o.why}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {o.picks.map((p, j) => (
                  <li key={j} className="flex flex-wrap items-center justify-between gap-2">
                    <span><strong>{p.person}:</strong> {p.dish} <span className="text-fg-muted">~{p.calories_est} kcal{p.note ? ` · ${p.note}` : ""}</span></span>
                    {canLog && p.person === myName ? (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
                        const r = await addFoodItems(me, mealForHour(new Date().getHours()), [{ description: `${p.dish} (${o.place})`, quantity: null, calories: p.calories_est, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }], "ai_estimate");
                        setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: "Logged to your food diary." });
                      })}>Log to my diary</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {result.tip ? <p className="text-sm">💡 {result.tip}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

export function AddPlaceForm() {
  const [state, action] = useActionState(addPlace, null);
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">+ Add a place</button>;
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <Field label="Place" className="sm:col-span-2"><Input name="name" required maxLength={120} placeholder="Good Flippin' Burgers" /></Field>
        <Field label="Cuisine"><Input name="cuisine" maxLength={60} placeholder="Burgers" /></Field>
        <Field label="Area"><Input name="area" maxLength={80} /></Field>
        <Field label="Type">
          <Select name="mode" defaultValue="both">
            <option value="both">Delivery & dine-in</option>
            <option value="delivery">Delivery</option>
            <option value="dine_in">Dine-in</option>
          </Select>
        </Field>
        <Field label="Order via"><Input name="order_via" maxLength={40} placeholder="Swiggy / Zomato / direct" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Input name="notes" maxLength={500} /></Field>
        <div className="flex items-center gap-2 sm:col-span-4">
          <SubmitButton>Add place</SubmitButton>
          <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>Close</button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}

export function AddDishForm({ placeId, members }: { placeId: string; members: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addDish, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-6 sm:items-end">
      <input type="hidden" name="placeId" value={placeId} />
      <Field label="Dish" className="sm:col-span-2"><Input name="name" required maxLength={120} /></Field>
      <Field label="₹"><Input name="price" type="number" min={0} /></Field>
      <Field label="kcal"><Input name="calories" type="number" min={0} placeholder="est." /></Field>
      <Field label="Veg?">
        <Select name="veg" defaultValue="">
          <option value="">–</option>
          <option value="veg">Veg</option>
          <option value="nonveg">Non-veg</option>
        </Select>
      </Field>
      <SubmitButton variant="secondary" size="sm">Add dish</SubmitButton>
      <div className="flex flex-wrap gap-3 sm:col-span-6">
        <span className="text-xs text-fg-muted">Go-to for:</span>
        {members.map((m) => (
          <label key={m.id} className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="go_to_for" value={m.id} className="accent-[var(--accent)]" /> {m.name}
          </label>
        ))}
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function LogOrderForm({ places }: { places: { id: string; name: string }[] }) {
  const [state, action] = useActionState(logOrder, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-6 sm:items-end">
      <Field label="From" className="sm:col-span-2">
        <Select name="place_id" defaultValue="">
          <option value="">Somewhere else</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="What we ordered" className="sm:col-span-2"><Input name="items" required maxLength={500} /></Field>
      <Field label="Total ₹"><Input name="total" type="number" min={0} /></Field>
      <Field label="Rating"><Input name="rating" type="number" min={1} max={5} /></Field>
      <div className="flex items-center gap-2 sm:col-span-6">
        <SubmitButton variant="secondary" size="sm">Save order</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
