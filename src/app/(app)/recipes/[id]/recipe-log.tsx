"use client";

import { useState, useTransition } from "react";
import { Button, Card, Checkbox, Field, Input, Notice, Select } from "@/components/ui";
import type { PersonPortion } from "@/components/nutrition-ui";
import type { Meal, Recipe } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, mealForHour } from "@/modules/food/meta";
import { cookedRecipe, logRecipeForPeople } from "../actions";

const KATORI_G = 150;

/**
 * Log a recipe for one or both people: by servings, grams or katoris (when the
 * cooked weight is known), and optionally "cooked today" to save leftovers.
 */
export function RecipeLog({ recipe, people, pantryOn }: { recipe: Recipe; people: PersonPortion[]; pantryOn: boolean }) {
  const servingG = recipe.total_weight_g ? Number(recipe.total_weight_g) / recipe.servings : null;
  const [unit, setUnit] = useState<"serving" | "gram" | "katori">("serving");
  const [amounts, setAmounts] = useState<Record<string, number>>(() => Object.fromEntries(people.map((p, i) => [p.id, i === 0 ? 1 : 0])));
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours()));
  const [cooked, setCooked] = useState(false);
  const [made, setMade] = useState(recipe.servings);
  const [days, setDays] = useState(2);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const toServings = (v: number) => (unit === "serving" ? v : unit === "gram" ? v / (servingG ?? 1) : (v * KATORI_G) / (servingG ?? 1));
  const perServingKcal = recipe.nutrition?.calories ?? recipe.calories_per_serving ?? null;
  const entries = Object.entries(amounts).filter(([, v]) => v > 0).map(([ownerId, v]) => ({ ownerId, servings: Math.round(toServings(v) * 100) / 100 }));
  const eaten = entries.reduce((a, e) => a + e.servings, 0);
  const amountStep = unit === "gram" ? 10 : unit === "katori" ? 0.5 : 0.25;

  function submit() {
    start(async () => {
      const res = cooked
        ? await cookedRecipe(recipe.id, { meal, made, people: entries, leftoverDays: days })
        : await logRecipeForPeople(recipe.id, entries, meal);
      setMsg(res.error ? { tone: "danger", text: res.error } : { tone: "accent", text: res.message ?? "Logged." });
    });
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">We ate this</h3>
        {recipe.nutrition ? <span className="text-xs text-accent">✓ calculated nutrition</span> : <span className="text-xs text-fg-muted">~ estimate (calculate it below for accuracy)</span>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Measure in" className="w-32">
          <Select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
            <option value="serving">Servings</option>
            {servingG ? <option value="gram">Grams</option> : null}
            {servingG ? <option value="katori">Katori (150 g)</option> : null}
          </Select>
        </Field>
        <Field label="Meal" className="w-32">
          <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEAL_ORDER.map((m) => (
              <option key={m} value={m}>{MEAL_META[m].label}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        {people.map((p) => (
          <Field key={p.id} label={p.name} className="w-28">
            <Input type="number" min={0} step={amountStep} value={amounts[p.id] ?? 0} onChange={(e) => setAmounts({ ...amounts, [p.id]: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
        ))}
      </div>
      {perServingKcal ? <p className="text-xs text-fg-muted">≈ {Math.round(Number(perServingKcal) * eaten)} kcal in total ({Math.round(eaten * 100) / 100} servings{servingG ? `, ${Math.round(servingG * eaten)} g` : ""})</p> : null}
      {!servingG ? <p className="text-xs text-fg-muted">Tip: add the cooked weight in the calculator below to log by grams or katori.</p> : null}

      {pantryOn ? (
        <div className="space-y-2 rounded-lg bg-surface-2 p-2">
          <Checkbox checked={cooked} onChange={(e) => setCooked(e.target.checked)} label="We cooked this today: save the leftovers to the fridge" />
          {cooked ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Servings made" className="w-28">
                <Input type="number" min={0.5} step={0.5} value={made} onChange={(e) => setMade(Math.max(0.5, Number(e.target.value) || recipe.servings))} />
              </Field>
              <Field label="Keeps for (days)" className="w-28">
                <Input type="number" min={1} max={7} value={days} onChange={(e) => setDays(Math.min(7, Math.max(1, Number(e.target.value) || 2)))} />
              </Field>
              <span className="pb-2 text-sm">{Math.max(0, Math.round((made - eaten) * 100) / 100)} portion(s) left over</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button size="sm" disabled={pending || (!entries.length && !cooked)} onClick={submit}>
        {pending ? "Saving…" : cooked ? "Log & save leftovers" : "Log"}
      </Button>
    </Card>
  );
}
