"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { shortDate, shortDay } from "@/lib/dates";
import type { GroceryCategory } from "@/lib/types";
import { MEAL_META, MEAL_ORDER } from "@/modules/food/meta";
import { addToGroceryList, addToPlan } from "../actions";

export function PlanForm({ recipes, days, today }: { recipes: { id: string; title: string; servings: number }[]; days: string[]; today: string }) {
  const [state, action] = useActionState(addToPlan, null);
  const [recipeId, setRecipeId] = useState("");
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_5rem_auto] sm:items-end">
        <Field label="Day">
          <Select name="plan_date" defaultValue={days.includes(today) ? today : days[0]}>
            {days.map((d) => (
              <option key={d} value={d}>{shortDay(d)} {shortDate(d)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Meal">
          <Select name="meal" defaultValue="dinner">
            {MEAL_ORDER.map((m) => (
              <option key={m} value={m}>{MEAL_META[m].label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Recipe or dish">
          {recipes.length ? (
            <Select name="recipe_id" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
              <option value="">Type a dish instead…</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </Select>
          ) : null}
          {!recipeId ? <Input name="title" maxLength={150} placeholder="e.g. Rajma chawal / eating out" className={recipes.length ? "mt-2" : ""} /> : null}
        </Field>
        <Field label="Servings">
          <Input name="servings" type="number" min={1} max={20} defaultValue={recipes.find((r) => r.id === recipeId)?.servings ?? 2} key={recipeId} />
        </Field>
        <SubmitButton>Plan</SubmitButton>
        <div className="sm:col-span-5">
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}

export function WeekGroceryButton({ items }: { items: { name: string; quantity: string | null; category: GroceryCategory }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await addToGroceryList(items);
            setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Added." });
          })
        }
      >
        🛒 Add {items.length} ingredient{items.length === 1 ? "" : "s"} for the rest of the week to the grocery list
      </Button>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </div>
  );
}
