"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card, Checkbox, Field, Input, Notice, Select } from "@/components/ui";
import type { MealIdea } from "@/lib/ai/phase2-schemas";
import type { Meal } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, mealForHour } from "@/modules/food/meta";
import { addToGroceryList, logRecipe, saveIdeaAsRecipe } from "@/app/(app)/recipes/actions";
import { addFoodItems } from "@/app/(app)/food/actions";

type Mode = "pantry" | "expiring" | "any";

export function MealIdeas({
  people,
  defaultSubject,
  defaultUseHealth,
  defaultMode,
  canLog,
  recipesOn,
  groceriesOn,
}: {
  people: { id: string; name: string }[];
  defaultSubject: string;
  defaultUseHealth: boolean;
  defaultMode: Mode;
  canLog: boolean;
  recipesOn: boolean;
  groceriesOn: boolean;
}) {
  const [subjectId, setSubjectId] = useState(defaultSubject);
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours() + 1));
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [servings, setServings] = useState(2);
  const [notes, setNotes] = useState("");
  const [useHealth, setUseHealth] = useState(defaultUseHealth);
  const [ideas, setIdeas] = useState<MealIdea[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/meal-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, meal, mode, maxMinutes, servings, notes: notes || undefined, useMedicalHistory: useHealth }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't get ideas");
      setIdeas(body.ideas);
      setRemaining(body.remaining);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={run} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            {people.length > 1 ? (
              <Field label="For">
                <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Meal">
              <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
                {MEAL_ORDER.map((m) => (
                  <option key={m} value={m}>{MEAL_META[m].label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time available">
              <Select value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))}>
                {[15, 20, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </Select>
            </Field>
            <Field label="Servings">
              <Input type="number" min={1} max={12} value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ingredients">
            {(
              [
                ["pantry", "🧺 From what we have"],
                ["expiring", "⏳ Use up what's expiring"],
                ["any", "🛒 Anything"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full border px-3 py-1.5 text-sm ${mode === m ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Field label="Anything else?">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="e.g. high protein, no rice, something comforting" />
          </Field>
          <Checkbox checked={useHealth} onChange={(e) => setUseHealth(e.target.checked)} label="Consider health data (conditions, labs, medicines, diary)" />
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button type="submit" disabled={loading}>{loading ? "Cooking up ideas…" : "✨ Suggest meals"}</Button>
        </form>
      </Card>

      {remaining !== null && ideas ? <p className="text-sm text-fg-muted">{remaining >= 0 ? `${remaining} kcal left today.` : `${-remaining} kcal over today's target.`}</p> : null}
      {ideas?.map((idea, i) => (
        <IdeaCard key={`${idea.title}-${i}`} idea={idea} meal={meal} subjectId={subjectId} canLog={canLog && subjectId === defaultSubject} recipesOn={recipesOn} groceriesOn={groceriesOn} />
      ))}
    </div>
  );
}

function IdeaCard({ idea, meal, subjectId, canLog, recipesOn, groceriesOn }: { idea: MealIdea; meal: Meal; subjectId: string; canLog: boolean; recipesOn: boolean; groceriesOn: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const missing = idea.ingredients.filter((i) => !i.in_pantry);
  const done = (r: { error?: string; message?: string }) => setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Done." });

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{idea.title}</h3>
          <p className="text-sm text-fg-muted">{idea.why}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge>{idea.prep_minutes + idea.cook_minutes} min</Badge>
          <Badge tone="accent">{idea.calories_per_serving} kcal/serving</Badge>
        </div>
      </div>
      <p className="text-xs text-fg-muted">
        Per serving: protein {Math.round(idea.protein_g)} g · carbs {Math.round(idea.carbs_g)} g · fat {Math.round(idea.fat_g)} g · serves {idea.servings}
      </p>
      <div>
        <p className="mb-1 text-sm font-medium">Ingredients</p>
        <ul className="grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
          {idea.ingredients.map((ing) => (
            <li key={ing.name} className={ing.in_pantry ? "" : "text-fg-muted"}>
              {ing.in_pantry ? "✓" : "＋"} {ing.name}{ing.quantity ? ` · ${ing.quantity}` : ""}
            </li>
          ))}
        </ul>
        {missing.length ? <p className="mt-1 text-xs text-fg-muted">＋ = not in the pantry</p> : null}
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium">Method</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {idea.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>
      <div className="flex flex-wrap gap-2">
        {recipesOn ? (
          <Button size="sm" variant="secondary" disabled={pending || Boolean(savedId)} onClick={() => start(async () => { const r = await saveIdeaAsRecipe(idea); if (r.id) setSavedId(r.id); done(r); })}>
            {savedId ? "Saved ✓" : "Save recipe"}
          </Button>
        ) : null}
        {groceriesOn && missing.length ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => done(await addToGroceryList(missing.map((m) => ({ name: m.name, quantity: m.quantity, category: m.category })))))}>
            Add {missing.length} missing to grocery list
          </Button>
        ) : null}
        {canLog ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () =>
                done(
                  savedId
                    ? await logRecipe(savedId, subjectId, meal, 1)
                    : await addFoodItems(subjectId, meal, [{ description: idea.title, quantity: "1 serving", calories: idea.calories_per_serving, protein_g: idea.protein_g, carbs_g: idea.carbs_g, fat_g: idea.fat_g, fiber_g: 0 }], "ai_estimate"),
                ),
              )
            }
          >
            I ate this (1 serving)
          </Button>
        ) : null}
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </Card>
  );
}
