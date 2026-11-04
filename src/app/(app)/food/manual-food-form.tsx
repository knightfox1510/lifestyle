"use client";

import { useActionState, useState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { MEAL_META, MEAL_ORDER, eatenAtFor, mealForHour, type LogDay } from "@/modules/food/meta";
import type { Meal } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import { addManualFood } from "./actions";

export function ManualFoodForm({ ownerId, day, meal: preset, defaultOpen = false }: { ownerId: string; day?: LogDay; meal?: Meal; defaultOpen?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const [meal, setMeal] = useState<Meal>(preset ?? mealForHour(new Date().getHours()));
  const [state, action] = useActionState(addManualFood, null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-fg-muted hover:text-fg">
        + {t("Enter calories yourself")}
      </button>
    );
  }
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-6">
        <input type="hidden" name="ownerId" value={ownerId} />
        <input type="hidden" name="eaten_at" value={eatenAtFor(day, meal) ?? ""} />
        <Field label="Food" className="sm:col-span-3">
          <Input name="description" required maxLength={200} />
        </Field>
        <Field label="Quantity">
          <Input name="quantity" maxLength={60} placeholder="1 bowl" />
        </Field>
        <Field label="Meal" className="sm:col-span-2">
          <Select name="meal" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEAL_ORDER.map((m) => (
              <option key={m} value={m}>{t(MEAL_META[m].label)}</option>
            ))}
          </Select>
        </Field>
        {[
          ["calories", "kcal"],
          ["protein_g", "Protein g"],
          ["carbs_g", "Carbs g"],
          ["fat_g", "Fat g"],
          ["fiber_g", "Fibre g"],
        ].map(([name, label]) => (
          <Field key={name} label={label}>
            <Input name={name} type="number" min={0} step="any" />
          </Field>
        ))}
        <div className="flex items-end gap-2 sm:col-span-6">
          <SubmitButton>Add</SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className="h-10 px-3 text-sm text-fg-muted">Close</button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
