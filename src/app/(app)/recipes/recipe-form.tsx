"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { Recipe } from "@/lib/types";
import { saveRecipe } from "./actions";

export function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const router = useRouter();
  const [state, action] = useActionState(saveRecipe, null);
  useEffect(() => {
    if (state?.ok && state.id) router.push(`/recipes/${state.id}`);
  }, [state, router]);

  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={recipe?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Title" className="sm:col-span-3">
            <Input name="title" required maxLength={150} defaultValue={recipe?.title} placeholder="Palak paneer" />
          </Field>
          <Field label="Servings">
            <Input name="servings" type="number" min={1} max={20} required defaultValue={recipe?.servings ?? 2} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea name="description" maxLength={1000} defaultValue={recipe?.description ?? ""} className="min-h-12" />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {(
            [
              ["prep_minutes", "Prep min", recipe?.prep_minutes],
              ["cook_minutes", "Cook min", recipe?.cook_minutes],
              ["calories_per_serving", "kcal/serving", recipe?.calories_per_serving],
              ["protein_g", "Protein g", recipe?.protein_g],
              ["carbs_g", "Carbs g", recipe?.carbs_g],
              ["fat_g", "Fat g", recipe?.fat_g],
            ] as const
          ).map(([name, label, v]) => (
            <Field key={name} label={label}>
              <Input name={name} type="number" min={0} step="any" defaultValue={v ?? ""} />
            </Field>
          ))}
        </div>
        <Field label="Ingredients" hint="One per line. Optional quantity first, separated by |, e.g. “200 g | paneer”.">
          <Textarea
            name="ingredients"
            className="min-h-32 font-mono text-sm"
            defaultValue={recipe?.ingredients.map((i) => (i.quantity ? `${i.quantity} | ${i.name}` : i.name)).join("\n") ?? ""}
          />
        </Field>
        <Field label="Steps" hint="One step per line.">
          <Textarea name="steps" className="min-h-32" defaultValue={recipe?.steps.join("\n") ?? ""} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tags" hint="Comma separated">
            <Input name="tags" defaultValue={recipe?.tags.join(", ") ?? ""} placeholder="high protein, quick, vegetarian" />
          </Field>
          <Field label="Source link">
            <Input name="source_url" type="url" defaultValue={recipe?.source_url ?? ""} placeholder="https://" />
          </Field>
        </div>
        <ActionMessage state={state} />
        <SubmitButton>{recipe ? "Save changes" : "Save recipe"}</SubmitButton>
      </form>
    </Card>
  );
}
