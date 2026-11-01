"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Checkbox, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { NutritionGoals } from "@/lib/types";
import { ACTIVITY_LABEL, COOKING_LABEL, DIET_LABEL, GOAL_LABEL } from "@/modules/food/meta";
import { saveNutritionGoals } from "../actions";

type Targets = { calories: string; protein_g: string; carbs_g: string; fat_g: string; fiber_g: string; water_ml: string };
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

export function GoalsForm({
  ownerId,
  goals,
  canWrite,
  maintenance,
  weight,
  defaultUseHealth,
}: {
  ownerId: string;
  goals: NutritionGoals | null;
  canWrite: boolean;
  maintenance: number | null;
  weight: number | null;
  defaultUseHealth: boolean;
}) {
  const [state, action] = useActionState(saveNutritionGoals, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [targets, setTargets] = useState<Targets>({
    calories: str(goals?.calories),
    protein_g: str(goals?.protein_g),
    carbs_g: str(goals?.carbs_g),
    fat_g: str(goals?.fat_g),
    fiber_g: str(goals?.fiber_g),
    water_ml: str(goals?.water_ml),
  });
  const [rationale, setRationale] = useState(goals?.rationale ?? "");
  const [useHealth, setUseHealth] = useState(defaultUseHealth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    const fd = new FormData(formRef.current!);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/nutrition-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: ownerId,
          goal: fd.get("goal"),
          activity_level: fd.get("activity_level"),
          diet_type: fd.get("diet_type"),
          useMedicalHistory: useHealth,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Suggestion failed");
      setTargets({
        calories: str(body.calories),
        protein_g: str(body.protein_g),
        carbs_g: str(body.carbs_g),
        fat_g: str(body.fat_g),
        fiber_g: str(body.fiber_g),
        water_ml: str(body.water_ml),
      });
      setRationale(body.rationale);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="ownerId" value={ownerId} />
      <fieldset disabled={!canWrite} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Goal">
            <Select name="goal" defaultValue={goals?.goal ?? "maintain"}>
              {Object.entries(GOAL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Activity">
            <Select name="activity_level" defaultValue={goals?.activity_level ?? "moderate"}>
              {Object.entries(ACTIVITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Diet">
            <Select name="diet_type" defaultValue={goals?.diet_type ?? "any"}>
              {Object.entries(DIET_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cooking style">
            <Select name="cooking_style" defaultValue={goals?.cooking_style ?? "quick"}>
              {Object.entries(COOKING_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Favourite cuisines" hint="Comma separated">
            <Input name="cuisines" defaultValue={goals?.cuisines.join(", ") ?? ""} placeholder="North Indian, South Indian, Thai" />
          </Field>
          <Field label="Avoid / dislike">
            <Input name="dislikes" maxLength={500} defaultValue={goals?.dislikes ?? ""} placeholder="mushrooms, very spicy food" />
          </Field>
        </div>

        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          {maintenance ? (
            <p>Estimated maintenance: <strong>~{maintenance} kcal/day</strong>{weight ? ` at ${weight} kg` : ""}.</p>
          ) : (
            <p className="text-fg-muted">Add your weight (Body) and height and date of birth (Medical → Health profile) for a better estimate.</p>
          )}
          {canWrite ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" onClick={suggest} disabled={loading}>
                {loading ? "Thinking…" : "✨ Suggest targets with AI"}
              </Button>
              <Checkbox checked={useHealth} onChange={(e) => setUseHealth(e.target.checked)} label="Consider my health data" />
            </div>
          ) : null}
          {error ? <div className="mt-2"><Notice tone="danger">{error}</Notice></div> : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {(
            [
              ["calories", "Calories"],
              ["protein_g", "Protein g"],
              ["carbs_g", "Carbs g"],
              ["fat_g", "Fat g"],
              ["fiber_g", "Fibre g"],
              ["water_ml", "Water ml"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <Input name={k} type="number" min={0} value={targets[k]} onChange={(e) => setTargets({ ...targets, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <Field label="Why these targets">
          <Textarea name="rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={2000} className="min-h-16" />
        </Field>
      </fieldset>
      <ActionMessage state={state} />
      {canWrite ? <SubmitButton>Save goals</SubmitButton> : null}
    </form>
  );
}
