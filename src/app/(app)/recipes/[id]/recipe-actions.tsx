"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { Meal, Recipe, RecipeIngredient } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, mealForHour } from "@/modules/food/meta";
import { addToGroceryList, addToPlan, logRecipe } from "../actions";

/** Scales a leading number in a quantity string ("200 g" × 1.5 → "300 g"). */
function scaleQty(q: string | null, factor: number) {
  if (!q || factor === 1) return q;
  return q.replace(/^(\d+(?:\.\d+)?)(\/(\d+))?/, (_m, a: string, _f, b?: string) => {
    const v = (b ? Number(a) / Number(b) : Number(a)) * factor;
    return String(Math.round(v * 100) / 100);
  });
}

export function RecipeActions({
  recipe,
  ingredients,
  pantryTracked,
  ownerId,
  canLog,
  groceriesOn,
  today,
}: {
  recipe: Recipe;
  ingredients: (RecipeIngredient & { have: boolean })[];
  pantryTracked: boolean;
  ownerId: string;
  canLog: boolean;
  groceriesOn: boolean;
  today: string;
}) {
  const [servings, setServings] = useState(recipe.servings);
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours()));
  const [eatServings, setEatServings] = useState(1);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [planState, planAction] = useActionState(addToPlan, null);
  const factor = servings / recipe.servings;
  const missing = ingredients.filter((i) => !i.have);
  const done = (r: { error?: string; message?: string }) => setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Done." });

  return (
    <>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Ingredients</h3>
          <label className="flex items-center gap-2 text-sm">
            Servings
            <Input type="number" min={1} max={20} value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))} className="!h-8 w-16" />
          </label>
        </div>
        <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {ingredients.map((i) => (
            <li key={i.name} className={pantryTracked && !i.have ? "text-fg-muted" : ""}>
              {pantryTracked ? (i.have ? "✓ " : "＋ ") : "• "}
              {scaleQty(i.quantity, factor) ? <span className="tabular-nums">{scaleQty(i.quantity, factor)} </span> : null}
              {i.name}
            </li>
          ))}
        </ul>
        {groceriesOn && ingredients.length ? (
          <div className="flex flex-wrap gap-2">
            {pantryTracked && missing.length ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => done(await addToGroceryList(missing.map((m) => ({ name: m.name, quantity: scaleQty(m.quantity, factor), category: m.category })))))}>
                Add {missing.length} missing to grocery list
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => done(await addToGroceryList(ingredients.map((m) => ({ name: m.name, quantity: scaleQty(m.quantity, factor), category: m.category })))))}>
              Add all to grocery list
            </Button>
          </div>
        ) : null}
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {canLog && recipe.calories_per_serving ? (
          <Card className="space-y-2">
            <h3 className="text-sm font-semibold">I ate this</h3>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Servings" className="w-24">
                <Input type="number" min={0.25} max={10} step={0.25} value={eatServings} onChange={(e) => setEatServings(Number(e.target.value) || 1)} />
              </Field>
              <Field label="Meal" className="w-32">
                <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
                  {MEAL_ORDER.map((m) => (
                    <option key={m} value={m}>{MEAL_META[m].label}</option>
                  ))}
                </Select>
              </Field>
              <Button size="sm" disabled={pending} onClick={() => start(async () => done(await logRecipe(recipe.id, ownerId, meal, eatServings)))}>
                Log ~{Math.round(recipe.calories_per_serving * eatServings)} kcal
              </Button>
            </div>
          </Card>
        ) : null}
        <Card>
          <form action={planAction} className="space-y-2">
            <h3 className="text-sm font-semibold">Plan it</h3>
            <input type="hidden" name="recipe_id" value={recipe.id} />
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Date" className="w-36">
                <Input type="date" name="plan_date" defaultValue={today} min={today} required />
              </Field>
              <Field label="Meal" className="w-28">
                <Select name="meal" defaultValue="dinner">
                  {MEAL_ORDER.map((m) => (
                    <option key={m} value={m}>{MEAL_META[m].label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Servings" className="w-20">
                <Input type="number" name="servings" min={1} max={20} defaultValue={recipe.servings} />
              </Field>
              <SubmitButton size="sm">Add to plan</SubmitButton>
            </div>
            <ActionMessage state={planState} />
          </form>
        </Card>
      </div>
    </>
  );
}
