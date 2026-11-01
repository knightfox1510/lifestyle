"use client";

import { useState, useTransition } from "react";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { NUTRIENT_KEYS, NUTRIENT_META, type NutrientKey } from "@/modules/nutrition/nutrients";
import { saveCustomFood } from "../actions";

/** Add a food by hand (values per 100 g), e.g. from a pack or a homemade staple. */
export function ManualFoodCreator() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [serving, setServing] = useState("");
  const [vals, setVals] = useState<Partial<Record<NutrientKey, string>>>({});
  const [more, setMore] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-fg-muted hover:text-fg">+ Add a food by hand</button>;
  const keys = more ? NUTRIENT_KEYS : (["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg"] as const);
  return (
    <Card className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Food" className="sm:col-span-2"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Homemade ghee, my granola…" /></Field>
        <Field label="Serving (g)"><Input type="number" min={0} value={serving} onChange={(e) => setServing(e.target.value)} placeholder="optional" /></Field>
      </div>
      <p className="text-xs text-fg-muted">Values per 100 g (or 100 ml).</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {keys.map((k) => (
          <Field key={k} label={`${NUTRIENT_META[k].label} (${NUTRIENT_META[k].unit})`}>
            <Input type="number" min={0} step="any" value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
          </Field>
        ))}
      </div>
      <button type="button" className="text-xs text-accent" onClick={() => setMore(!more)}>{more ? "Fewer nutrients" : "Add vitamins & minerals"}</button>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex gap-2">
        <Button
          disabled={pending || !name.trim() || !vals.calories}
          onClick={() =>
            start(async () => {
              const nutrients = Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== "" && v !== undefined).map(([k, v]) => [k, Number(v)]));
              const r = await saveCustomFood({ name, source: "manual", serving_g: serving ? Number(serving) : null, nutrients });
              setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Saved." });
              if (!r.error) { setName(""); setVals({}); setServing(""); }
            })
          }
        >
          Save food
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </Card>
  );
}
