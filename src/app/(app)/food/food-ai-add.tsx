"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Notice, Select, Textarea } from "@/components/ui";
import { VoiceButton } from "@/components/voice-input";
import { AccuracyBadge, FoodSearch, PeoplePortions, type FoodHit, type PersonPortion } from "@/components/nutrition-ui";
import { compressImage } from "@/lib/compress-image";
import type { Meal } from "@/lib/types";
import { MEAL_DEFAULT_TIME, MEAL_META, MEAL_ORDER, eatenAtFor, mealForHour, type LogDay } from "@/modules/food/meta";
import { computeItem, type CalcItem } from "@/modules/nutrition/compute";
import { IRRITANT_META, type Irritant } from "@/modules/nutrition/irritants";
import { logFoodForPeople } from "./actions";
import { PantryUsePrompt } from "@/components/pantry-use-prompt";
import { useT } from "@/lib/i18n/client";

type Item = CalcItem & { keep: boolean; open: boolean };

/**
 * Describe, say or photograph a meal → AI breaks it into your saved recipes or
 * ingredients with grams → nutrition is calculated from food data (macros +
 * micronutrients). Grams and matches are editable; log for one or both of you.
 */
export function FoodAiAdd({ ownerId, people, day, meal: preset }: { ownerId: string; people: PersonPortion[]; day?: LogDay; meal?: Meal }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [meal, setMeal] = useState<Meal>(() => preset ?? mealForHour(new Date().getHours()));
  const [note, setNote] = useState<string | null>(null);
  const [who, setWho] = useState<Record<string, number>>({ [ownerId]: 1 });
  const [msg, setMsg] = useState<{ tone: "danger" | "accent"; text: string } | null>(null);
  const [saving, start] = useTransition();
  const [usedNames, setUsedNames] = useState<string[] | null>(null);
  const t = useT();

  async function estimate() {
    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("text", text);
    fd.set("time", day && day.date !== day.today ? `${MEAL_DEFAULT_TIME[meal]} on ${day.date}` : new Date().toTimeString().slice(0, 5));
    if (photo) fd.set("photo", await compressImage(photo, 1600));
    try {
      const res = await fetch("/api/ai/food-estimate", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Estimate failed");
      setItems((body.items as CalcItem[]).map((i) => ({ ...i, keep: true, open: false })));
      // A meal chosen with "＋ Add" (or an earlier day) wins over the AI's guess from the clock.
      if (!preset && (!day || day.date === day.today)) setMeal(body.meal);
      setNote(body.note);
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const update = (i: number, patch: Partial<Item>) => setItems(items!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const updateComp = (i: number, c: number, patch: Partial<CalcItem["components"][number]>) =>
    update(i, { components: items![i].components.map((x, k) => (k === c ? { ...x, ...patch } : x)) });

  function save() {
    if (!items) return;
    const chosen = Object.entries(who).filter(([, f]) => f > 0).map(([id, f]) => ({ ownerId: id, factor: f }));
    start(async () => {
      const payload = items
        .filter((i) => i.keep)
        .map((i) => {
          const c = computeItem(i);
          return {
            description: i.description,
            quantity: i.quantity,
            grams: c.grams,
            nutrients: c.nutrients as Record<string, number>,
            accuracy: c.accuracy,
            irritants: i.irritants,
            recipe_id: i.recipe && i.recipe.kind !== "dish" ? i.recipe.id : null,
            source: photo ? ("photo" as const) : i.recipe && i.recipe.kind !== "dish" ? ("recipe" as const) : ("ai_estimate" as const),
          };
        });
      const res = await logFoodForPeople(chosen, meal, payload, eatenAtFor(day, meal));
      if (res.error) setMsg({ tone: "danger", text: res.error });
      else {
        setMsg({ tone: "accent", text: res.message ?? "Added." });
        // Home-cooked meals: offer to update the pantry for the ingredients used.
        const names = items.filter((i) => i.keep).flatMap((i) => (i.components.length ? i.components.flatMap((c) => [c.name, c.matchName ?? ""]) : [i.description]));
        if (names.length) setUsedNames(names);
        setItems(null);
        setText("");
        setPhoto(null);
      }
    });
  }

  return (
    <Card className="space-y-3">
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("What did you eat? e.g. “2 rotis with ghee, a katori of toor dal, bhindi sabzi and a cup of chai”")}
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
        {loading ? t("Working it out…") : `✨ ${t("Calculate")}`}
      </Button>
      <p className="text-xs text-fg-muted">{t("Uses your saved recipes and foods first, then ingredients by weight. You can fix any grams before logging.")}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {usedNames ? <PantryUsePrompt names={usedNames} onDone={() => setUsedNames(null)} /> : null}

      {items ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{t("Check and log")}</p>
            <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} className="w-36" aria-label="Meal">
              {MEAL_ORDER.map((m) => (
                <option key={m} value={m}>{t(MEAL_META[m].label)}</option>
              ))}
            </Select>
          </div>
          {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
          <ul className="space-y-2">
            {items.map((it, i) => {
              const c = computeItem(it);
              return (
                <li key={i} className={`rounded-lg border border-border p-2 ${it.keep ? "" : "opacity-50"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={it.keep} onChange={(e) => update(i, { keep: e.target.checked })} aria-label={`Keep ${it.description}`} />
                    <Input value={it.description} onChange={(e) => update(i, { description: e.target.value })} className="!h-8 min-w-40 flex-1" aria-label="Food" />
                    <AccuracyBadge accuracy={c.accuracy} />
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    <strong className="text-fg">{Math.round(c.nutrients.calories ?? 0)} kcal</strong> · P {c.nutrients.protein_g ?? 0} · C {c.nutrients.carbs_g ?? 0} · F {c.nutrients.fat_g ?? 0} · fibre {c.nutrients.fiber_g ?? 0} g
                    {c.nutrients.iron_mg != null ? ` · iron ${c.nutrients.iron_mg} mg` : ""}
                    {c.nutrients.calcium_mg != null ? ` · calcium ${Math.round(c.nutrients.calcium_mg)} mg` : ""}
                    {c.grams ? ` · ${Math.round(c.grams)} g` : ""}
                  </p>
                  {it.irritants.length ? (
                    <p className="text-xs text-fg-muted">Bladder irritants: {it.irritants.map((x) => `${IRRITANT_META[x as Irritant]?.icon ?? ""} ${IRRITANT_META[x as Irritant]?.label ?? x}`).join(", ")}</p>
                  ) : null}
                  {it.recipe ? (
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      {it.recipe.kind === "dish" ? "Indian dish" : "From your recipe"} <strong>{it.recipe.title}</strong> ·
                      <Input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={it.recipe.servings}
                        onChange={(e) => update(i, { recipe: { ...it.recipe!, servings: Math.max(0.25, Number(e.target.value) || 1) } })}
                        className="!h-7 w-16"
                        aria-label="Servings"
                      />
                      servings
                    </div>
                  ) : (
                    <>
                      <button type="button" className="mt-1 text-xs text-accent" onClick={() => update(i, { open: !it.open })}>
                        {it.open ? "Hide" : "Show"} ingredients ({it.components.length})
                      </button>
                      {it.open ? (
                        <div className="mt-1 space-y-1">
                          {it.components.map((comp, k) => (
                            <div key={k} className="flex flex-wrap items-center gap-1.5 text-xs">
                              <Input type="number" min={0} value={comp.grams} onChange={(e) => updateComp(i, k, { grams: Math.max(0, Number(e.target.value) || 0) })} className="!h-7 w-20" aria-label={`${comp.name} grams`} />
                              g <span className="font-medium">{comp.name}</span>
                              <span className={comp.per100 ? "text-fg-muted" : "text-danger"}>→ {comp.matchName ? `${comp.matchName} (${comp.source})` : "not matched"}</span>
                              <button type="button" className="text-fg-muted hover:text-danger" aria-label="Remove ingredient" onClick={() => update(i, { components: it.components.filter((_, x) => x !== k) })}>✕</button>
                            </div>
                          ))}
                          <FoodSearch
                            placeholder="Add or fix an ingredient…"
                            onPick={(f: FoodHit) => {
                              const unmatched = it.components.findIndex((x) => !x.per100);
                              const per100 = f.per100 ?? null;
                              if (unmatched >= 0) updateComp(i, unmatched, { per100, matchName: f.name, source: f.source, ref: f.ref });
                              else update(i, { components: [...it.components, { name: f.name, grams: 100, per100, matchName: f.name, source: f.source, ref: f.ref }] });
                            }}
                          />
                          <p className="text-[11px] text-fg-muted">Picking a food fills the first unmatched ingredient, or adds a new 100 g row.</p>
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <PeoplePortions people={people} value={who} onChange={setWho} />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving || !items.some((i) => i.keep) || !Object.values(who).some((v) => v > 0)}>
              {saving ? t("Adding…") : `${t("Add to")} ${t(MEAL_META[meal].label)}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setItems(null)}>{t("Discard")}</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
