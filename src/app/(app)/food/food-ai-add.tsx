"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Notice, Select, Textarea } from "@/components/ui";
import { VoiceButton } from "@/components/voice-input";
import type { FoodItem } from "@/lib/ai/phase2-schemas";
import type { Meal } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, mealForHour } from "@/modules/food/meta";
import { addFoodItems } from "./actions";

export function FoodAiAdd({ ownerId }: { ownerId: string }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<(FoodItem & { keep: boolean })[] | null>(null);
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours()));
  const [note, setNote] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "danger" | "accent"; text: string } | null>(null);
  const [saving, start] = useTransition();

  async function estimate() {
    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("text", text);
    fd.set("time", new Date().toTimeString().slice(0, 5));
    if (photo) fd.set("photo", photo);
    try {
      const res = await fetch("/api/ai/food-estimate", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Estimate failed");
      setItems(body.items.map((i: FoodItem) => ({ ...i, keep: true })));
      setMeal(body.meal);
      setNote(body.note);
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!items) return;
    start(async () => {
      const keep = items
        .filter((i) => i.keep)
        .map((i) => ({ description: i.description, quantity: i.quantity, calories: i.calories, protein_g: i.protein_g, carbs_g: i.carbs_g, fat_g: i.fat_g, fiber_g: i.fiber_g }));
      const res = await addFoodItems(ownerId, meal, keep, photo ? "photo" : "ai_estimate");
      if (res.error) setMsg({ tone: "danger", text: res.error });
      else {
        setMsg({ tone: "accent", text: res.message ?? "Added." });
        setItems(null);
        setText("");
        setPhoto(null);
      }
    });
  }

  const update = (i: number, patch: Partial<FoodItem & { keep: boolean }>) => setItems(items!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v)));

  return (
    <Card className="space-y-3">
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you eat? e.g. “2 rotis, a katori of dal, cucumber salad and a cup of chai”"
          className="min-h-12 flex-1"
          maxLength={1000}
        />
        <div className="flex flex-col gap-2">
          <VoiceButton onText={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
          <label className="flex size-10 cursor-pointer items-center justify-center rounded-xl border border-border text-lg hover:bg-surface-2" title="Add a photo">
            📷
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>
      {photo ? (
        <p className="text-xs text-fg-muted">
          Photo: {photo.name} <button className="underline" onClick={() => setPhoto(null)}>remove</button>
        </p>
      ) : null}
      <Button onClick={estimate} disabled={loading || (!text.trim() && !photo)}>
        {loading ? "Estimating…" : "✨ Estimate calories"}
      </Button>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {items ? (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Check the estimate, then add</p>
            <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} className="w-36" aria-label="Meal">
              {MEAL_ORDER.map((m) => (
                <option key={m} value={m}>{MEAL_META[m].label}</option>
              ))}
            </Select>
          </div>
          {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-fg-muted">
                <tr><th /><th className="text-left font-medium">Food</th><th className="font-medium">kcal</th><th className="font-medium">Protein</th><th className="font-medium">Carbs</th><th className="font-medium">Fat</th></tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={it.keep} onChange={(e) => update(i, { keep: e.target.checked })} aria-label={`Keep ${it.description}`} /></td>
                    <td className="py-1 pr-2">
                      <Input value={it.description} onChange={(e) => update(i, { description: e.target.value })} className="!h-8" aria-label="Food" />
                    </td>
                    {(["calories", "protein_g", "carbs_g", "fat_g"] as const).map((k) => (
                      <td key={k} className="px-0.5">
                        <Input type="number" min={0} value={it[k]} onChange={(e) => update(i, { [k]: num(e.target.value) })} className="!h-8 w-16 text-right" aria-label={k} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving || !items.some((i) => i.keep)}>
              {saving ? "Adding…" : `Add to ${MEAL_META[meal].label.toLowerCase()}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setItems(null)}>Discard</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
