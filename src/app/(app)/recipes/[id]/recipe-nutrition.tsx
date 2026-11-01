"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, Field, Input, Notice, cx } from "@/components/ui";
import { FoodSearch } from "@/components/nutrition-ui";
import type { FoodRef, Recipe } from "@/lib/types";
import { MICRO_KEYS, NUTRIENT_META, forGrams, formatNutrient, scale, sum, type Nutrients } from "@/modules/nutrition/nutrients";
import { IRRITANTS, IRRITANT_META, type Irritant } from "@/modules/nutrition/irritants";
import { saveRecipeNutrition } from "../actions";

type Row = { index: number; grams: number; ref: FoodRef | null; match_name: string | null; source?: string | null; per100: Nutrients | null };

/** Ingredient-by-ingredient nutrition: grams × food data → per serving (macros + micronutrients). */
export function RecipeNutrition({ recipe }: { recipe: Recipe }) {
  const [rows, setRows] = useState<Row[]>(() =>
    recipe.ingredients.map((ing, index) => ({ index, grams: ing.grams ?? 0, ref: ing.ref ?? null, match_name: ing.match_name ?? null, per100: (ing.per100 as Nutrients) ?? null })),
  );
  const [weight, setWeight] = useState<string>(recipe.total_weight_g ? String(recipe.total_weight_g) : "");
  const [irritants, setIrritants] = useState<string[]>(recipe.irritants ?? []);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [saving, start] = useTransition();
  const [open, setOpen] = useState(!recipe.nutrition);

  const perServing = useMemo(() => {
    const used = rows.filter((r) => r.grams > 0 && r.per100);
    return scale(sum(used.map((r) => forGrams(r.per100!, r.grams))), 1 / recipe.servings);
  }, [rows, recipe.servings]);
  const unmatched = rows.filter((r) => r.grams > 0 && !r.per100);

  async function autofill() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/recipe-calc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipeId: recipe.id }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't work it out");
      const byIdx = new Map((body.rows as Row[]).map((r) => [r.index, r]));
      setRows(rows.map((r) => byIdx.get(r.index) ?? r));
      if (!weight && body.estimated_cooked_weight_g) setWeight(String(Math.round(body.estimated_cooked_weight_g)));
      setIrritants([...new Set([...irritants, ...(body.irritants ?? [])])]);
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    start(async () => {
      const res = await saveRecipeNutrition(recipe.id, {
        rows: rows.map((r) => ({ index: r.index, grams: r.grams, ref: r.ref, match_name: r.match_name, per100: r.per100 as Record<string, number> | null })),
        total_weight_g: weight ? Number(weight) : null,
        irritants,
      });
      setMsg(res.error ? { tone: "danger", text: res.error } : { tone: "accent", text: res.message ?? "Saved." });
    });
  }

  const upd = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">🧮 Nutrition by ingredients</h3>
        <button type="button" className="text-sm text-accent" onClick={() => setOpen(!open)}>{open ? "Hide" : recipe.nutrition ? "Edit" : "Calculate"}</button>
      </div>
      {recipe.nutrition && !open ? (
        <p className="text-sm">
          Per serving: <strong>{Math.round(Number(recipe.nutrition.calories ?? 0))} kcal</strong> · P {recipe.nutrition.protein_g ?? "–"} g · C {recipe.nutrition.carbs_g ?? "–"} g · F {recipe.nutrition.fat_g ?? "–"} g · fibre {recipe.nutrition.fiber_g ?? "–"} g
          {recipe.total_weight_g ? <span className="text-fg-muted"> · serving ≈ {Math.round(Number(recipe.total_weight_g) / recipe.servings)} g</span> : null}
        </p>
      ) : null}
      {open ? (
        <>
          <p className="text-xs text-fg-muted">Grams are for the whole pot (raw/dry weight for dal, rice and flour). AI can fill them in; check and adjust. Weigh the cooked dish once to log by grams or katori later.</p>
          <Button size="sm" variant="secondary" onClick={autofill} disabled={loading}>{loading ? "Working it out…" : "✨ Fill grams & match foods"}</Button>
          <ul className="divide-y divide-border text-sm">
            {recipe.ingredients.map((ing, i) => {
              const r = rows[i];
              return (
                <li key={i} className="space-y-1 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="number" min={0} value={r.grams} onChange={(e) => upd(i, { grams: Math.max(0, Number(e.target.value) || 0) })} className="!h-8 w-20" aria-label={`${ing.name} grams`} />
                    <span>g</span>
                    <span className="font-medium">{ing.name}</span>
                    {ing.quantity ? <span className="text-xs text-fg-muted">({ing.quantity})</span> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-1 text-xs">
                    <span className={cx(r.per100 ? "text-fg-muted" : r.grams > 0 ? "text-danger" : "text-fg-muted")}>
                      → {r.match_name ? `${r.match_name}${r.source ? ` · ${r.source}` : ""}` : r.grams > 0 ? "no food matched" : "skipped"}
                    </span>
                    <button type="button" className="text-accent" onClick={() => setEditing(editing === i ? null : i)}>{editing === i ? "cancel" : "change"}</button>
                  </div>
                  {editing === i ? (
                    <FoodSearch autoFocus onPick={(f) => { upd(i, { ref: f.ref, match_name: f.name, source: f.source, per100: f.per100 }); setEditing(null); }} />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Cooked weight of the whole pot (g)" className="w-56">
              <Input type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="optional" />
            </Field>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Bladder irritants in this dish</p>
            <div className="flex flex-wrap gap-1.5">
              {IRRITANTS.map((x) => (
                <button
                  key={x}
                  type="button"
                  aria-pressed={irritants.includes(x)}
                  onClick={() => setIrritants(irritants.includes(x) ? irritants.filter((y) => y !== x) : [...irritants, x])}
                  className={cx("rounded-full border px-2.5 py-0.5 text-xs", irritants.includes(x) ? "border-accent bg-accent-soft text-accent" : "border-border text-fg-muted")}
                >
                  {IRRITANT_META[x as Irritant].icon} {IRRITANT_META[x as Irritant].label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <p className="font-medium">
              Per serving (1 of {recipe.servings}): {Math.round(perServing.calories ?? 0)} kcal · P {perServing.protein_g ?? 0} g · C {perServing.carbs_g ?? 0} g · F {perServing.fat_g ?? 0} g · fibre {perServing.fiber_g ?? 0} g
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              {MICRO_KEYS.filter((k) => perServing[k] !== undefined).map((k) => `${NUTRIENT_META[k].label} ${formatNutrient(k, perServing[k])}`).join(" · ")}
            </p>
          </div>
          {unmatched.length ? <Notice tone="danger">Match a food (or set 0 g) for: {unmatched.map((u) => recipe.ingredients[u.index]?.name).join(", ")}</Notice> : null}
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <Button onClick={save} disabled={saving || unmatched.length > 0 || !rows.some((r) => r.grams > 0)}>{saving ? "Saving…" : "Save nutrition"}</Button>
        </>
      ) : null}
    </Card>
  );
}
