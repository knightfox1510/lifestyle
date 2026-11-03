"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button, Field, Input, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import type { Meal } from "@/lib/types";
import { MEAL_META, MEAL_ORDER } from "@/modules/food/meta";
import { deleteFood, updateFoodEntry } from "./actions";

const PORTIONS: [number, string][] = [
  [0.5, "½×"],
  [0.75, "¾×"],
  [1, "1×"],
  [1.5, "1½×"],
  [2, "2×"],
];

export type EntrySummary = { id: string; description: string; quantity: string | null; meal: Meal; time: string; calories: number | null; createdAt?: string };

/** A logged food: tap it to rename, change the amount, move it to another meal or time, or delete it. */
export function FoodEntryRow({ entry, ownerId, meta, canEdit, canDelete, children }: { entry: EntrySummary; ownerId: string; meta: string; canEdit: boolean; canDelete: boolean; children?: ReactNode }) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.description);
  const [quantity, setQuantity] = useState(entry.quantity ?? "");
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [time, setTime] = useState(entry.time);
  const [factor, setFactor] = useState(1);
  const [custom, setCustom] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  // Just logged (in the last half minute): glow briefly so it's clear where it went.
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (!entry.createdAt) return;
    const t = window.setTimeout(() => setFresh(Date.now() - Date.parse(entry.createdAt!) < 30_000), 0);
    return () => window.clearTimeout(t);
  }, [entry.createdAt]);
  const f = custom ? Number(custom) || 1 : factor;
  const newKcal = entry.calories == null ? null : Math.round(entry.calories * f);

  const reset = () => {
    setName(entry.description);
    setQuantity(entry.quantity ?? "");
    setMeal(entry.meal);
    setTime(entry.time);
    setFactor(1);
    setCustom("");
    setConfirmDelete(false);
  };

  function save() {
    start(async () => {
      const r = await updateFoodEntry(entry.id, ownerId, { description: name, quantity, meal, time, factor: f });
      if (r.error) toast(r.error, { tone: "error" });
      else {
        toast(meal !== entry.meal ? t("Moved to {meal}", { meal: t(MEAL_META[meal].label) }) : t("Saved."));
        setOpen(false);
      }
    });
  }

  return (
    <li className={cx("py-2 text-sm", fresh && "fx-fresh -mx-2 px-2")}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => { if (open) reset(); setOpen(!open); }}
          className={cx("min-w-0 flex-1 text-left", canEdit && "rounded-lg hover:bg-surface-2/60")}
          aria-expanded={open}
          aria-label={canEdit ? t("Edit {name}", { name: entry.description }) : undefined}
        >
          <span className="block truncate">
            {entry.description}
            {entry.quantity ? <span className="text-fg-muted"> · {entry.quantity}</span> : null}
          </span>
          <span className="text-xs text-fg-muted">{meta}</span>
          {children ? <span className="mt-0.5 block">{children}</span> : null}
        </button>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums">{entry.calories ?? "–"}</span>
          {canEdit ? (
            <button type="button" onClick={() => { if (open) reset(); setOpen(!open); }} className="rounded p-1 text-fg-muted hover:text-fg" aria-label={t("Edit {name}", { name: entry.description })}>
              <Pencil className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </span>
      </div>

      {open ? (
        <div className={cx("mt-2 space-y-3 rounded-xl border border-border bg-surface-2/40 p-3", pending && "opacity-60")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label={t("Name")} className="col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </Field>
            <Field label={t("Quantity")}>
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} maxLength={60} placeholder={t("1 katori")} />
            </Field>
            <Field label={t("Time")}>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-muted">{t("Meal")}</p>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_ORDER.map((m) => (
                <button key={m} type="button" onClick={() => setMeal(m)} aria-pressed={meal === m} className={cx("rounded-full border px-3 py-1 text-xs", meal === m ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
                  {MEAL_META[m].icon} {t(MEAL_META[m].label)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-muted">{t("Amount compared with what was logged")}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {PORTIONS.map(([v, label]) => (
                <button key={v} type="button" onClick={() => { setFactor(v); setCustom(""); }} aria-pressed={!custom && factor === v} className={cx("rounded-full border px-3 py-1 text-xs tabular-nums", !custom && factor === v ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
                  {label}
                </button>
              ))}
              <Input type="number" min={0.1} max={10} step={0.05} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="×" className="!h-8 w-16 text-xs" aria-label={t("Custom amount")} />
              {f !== 1 && newKcal != null ? <span className="text-xs text-fg-muted">→ {newKcal} kcal</span> : null}
            </div>
            {f !== 1 ? <p className="mt-1 text-xs text-fg-muted">{t("Calories, macros, vitamins and grams all scale. Update the quantity text to match.")}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={save} disabled={pending || !name.trim()}>{pending ? "…" : t("Save")}</Button>
            <Button size="sm" variant="ghost" onClick={() => { reset(); setOpen(false); }}>{t("Cancel")}</Button>
            {canDelete ? (
              confirmDelete ? (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
                  {t("Delete this entry?")}
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={pending}
                    onClick={() => start(async () => { const r = await deleteFood(entry.id, ownerId); if (r.error) toast(r.error, { tone: "error" }); else toast(t("Deleted.")); })}
                  >
                    {t("Yes, delete")}
                  </Button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto inline-flex items-center gap-1 text-xs text-danger">
                  <Trash2 className="size-3.5" aria-hidden /> {t("Delete")}
                </button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
