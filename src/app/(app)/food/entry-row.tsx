"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Bookmark, Copy, Pencil, Trash2 } from "lucide-react";
import { Button, Field, Input, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import type { Meal } from "@/lib/types";
import { MEAL_META, MEAL_ORDER } from "@/modules/food/meta";
import { copyEntries, deleteFood, saveMealTemplate, undoFoodEntries, updateFoodEntry } from "./actions";

const PORTIONS: [number, string][] = [
  [0.5, "½×"],
  [0.75, "¾×"],
  [1, "1×"],
  [1.5, "1½×"],
  [2, "2×"],
];

export type EntrySummary = { id: string; description: string; quantity: string | null; meal: Meal; time: string; calories: number | null; createdAt?: string; /** Signed URL of the meal photo, or an emoji for the food. */ photoUrl?: string | null; emoji?: string };

/** A logged food: tap it to rename, change the amount, move it to another meal or time, or delete it. */
export function FoodEntryRow({ entry, ownerId, meta, canEdit, canDelete, children, date, copyTo = [] }: { entry: EntrySummary; ownerId: string; meta: string; canEdit: boolean; canDelete: boolean; children?: ReactNode; /** The day it's on, for copying. */ date?: string; /** Others it can be copied to (long-press menu). */ copyTo?: { id: string; name: string }[] }) {
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
  // Phones: swipe left to show Delete, swipe right to edit.
  const [dx, setDx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const touch = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const swiped = useRef(false);
  // Long-press (or right-click) opens a menu of quick actions.
  const [menu, setMenu] = useState(false);
  const press = useRef<number | null>(null);
  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current);
    press.current = null;
  };
  const openMenu = () => {
    cancelPress();
    swiped.current = true;
    window.setTimeout(() => (swiped.current = false), 400);
    try {
      navigator.vibrate?.(15);
    } catch {
      /* ignore */
    }
    setMenu(true);
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || open || !canEdit) return;
    touch.current = { x: e.clientX, y: e.clientY, dragging: false };
    press.current = window.setTimeout(openMenu, 520);
  };
  const onMove = (e: React.PointerEvent) => {
    const t0 = touch.current;
    if (!t0) return;
    const ddx = e.clientX - t0.x;
    const ddy = e.clientY - t0.y;
    if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) cancelPress();
    if (!t0.dragging && Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.4) {
      t0.dragging = true;
      setDragging(true);
    }
    if (t0.dragging) setDx(Math.max(canDelete ? -110 : 0, Math.min(110, ddx + (revealed ? -88 : 0))));
  };
  const onUp = () => {
    cancelPress();
    const t0 = touch.current;
    touch.current = null;
    setDragging(false);
    if (!t0?.dragging) return;
    swiped.current = true;
    window.setTimeout(() => (swiped.current = false), 50);
    if (dx > 70) {
      setDx(0);
      setRevealed(false);
      reset();
      setOpen(true);
    } else if (dx < -60 && canDelete) {
      setDx(-88);
      setRevealed(true);
    } else {
      setDx(0);
      setRevealed(false);
    }
  };
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
    <li className={cx("relative overflow-hidden text-sm", fresh && "fx-fresh -mx-2 px-2")}>
      {dx !== 0 ? (
        <div className="absolute inset-0 flex items-center justify-between rounded-lg px-4 text-xs font-medium" aria-hidden={!revealed}>
          <span className={cx("flex items-center gap-1 text-accent transition-opacity", dx > 30 ? "opacity-100" : "opacity-0")}><Pencil className="size-4" aria-hidden /> {t("Edit")}</span>
          {canDelete ? (
            <button
              type="button"
              tabIndex={revealed ? 0 : -1}
              disabled={pending}
              onClick={() => start(async () => { const r = await deleteFood(entry.id, ownerId); if (r.error) { toast(r.error, { tone: "error" }); setDx(0); setRevealed(false); } else toast(t("Deleted.")); })}
              className={cx("-mr-4 flex h-full items-center gap-1 bg-danger px-5 text-white transition-opacity", dx < -30 ? "opacity-100" : "opacity-0")}
            >
              <Trash2 className="size-4" aria-hidden /> {t("Delete")}
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className="relative flex touch-pan-y items-center justify-between gap-2 bg-surface py-2"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? "none" : "transform .22s cubic-bezier(.3,1.2,.5,1)" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          openMenu();
        }}
      >
        {entry.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.photoUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover shadow-[0_0_0_1px_var(--border)]" loading="lazy" />
        ) : entry.emoji ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-[20px]" aria-hidden>{entry.emoji}</span>
        ) : null}
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => { if (swiped.current) return; if (revealed) { setDx(0); setRevealed(false); return; } if (open) reset(); setOpen(!open); }}
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

      {menu ? (
        <div role="menu" aria-label={t("Actions for {name}", { name: entry.description })} className="mb-2 space-y-2 rounded-xl border border-accent/40 bg-surface p-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/.35)] [animation:toast-in_.18s_ease-out]">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{entry.emoji ? `${entry.emoji} ` : ""}{entry.description}</p>
            <button type="button" className="text-xs text-fg-muted" onClick={() => setMenu(false)}>{t("Close")}</button>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-fg-muted">{t("Move to")}</p>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_ORDER.filter((m) => m !== entry.meal).map((m) => (
                <button key={m} type="button" role="menuitem" disabled={pending} className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                  onClick={() => start(async () => { const r = await updateFoodEntry(entry.id, ownerId, { description: entry.description, quantity: entry.quantity ?? "", meal: m, time: entry.time, factor: 1 }); toast(r.error ?? t("Moved to {meal}", { meal: t(MEAL_META[m].label) }), r.error ? { tone: "error" } : { kind: "food", stamp: false }); setMenu(false); })}>
                  {MEAL_META[m].icon} {t(MEAL_META[m].label)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {date ? copyTo.map((p) => (
              <button key={p.id} type="button" role="menuitem" disabled={pending} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium"
                onClick={() => start(async () => { const r = await copyEntries({ entryIds: [entry.id], targets: [{ ownerId: p.id, factor: 1 }], meal: entry.meal, toDate: date }); toast(r.error ?? t("Copied to {name}", { name: p.name }), r.error ? { tone: "error" } : { kind: "food", undo: r.ids?.length ? () => undoFoodEntries(r.ids!) : undefined }); setMenu(false); })}>
                <Copy className="size-3.5" aria-hidden /> {t("Copy to {name}", { name: p.name })}
              </button>
            )) : null}
            <button type="button" role="menuitem" disabled={pending} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"
              onClick={() => start(async () => { const r = await saveMealTemplate({ entryIds: [entry.id], name: entry.description.slice(0, 80), meal: entry.meal }); toast(r.error ?? r.message ?? "Saved.", r.error ? { tone: "error" } : { kind: "save" }); setMenu(false); })}>
              <Bookmark className="size-3.5" aria-hidden /> {t("Save as a meal")}
            </button>
            <button type="button" role="menuitem" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs" onClick={() => { setMenu(false); reset(); setOpen(true); }}>
              <Pencil className="size-3.5" aria-hidden /> {t("Edit")}
            </button>
            {canDelete ? (
              <button type="button" role="menuitem" disabled={pending} className="inline-flex items-center gap-1 rounded-full border border-danger/40 px-3 py-1 text-xs text-danger"
                onClick={() => start(async () => { const r = await deleteFood(entry.id, ownerId); toast(r.error ?? t("Deleted."), r.error ? { tone: "error" } : undefined); setMenu(false); })}>
                <Trash2 className="size-3.5" aria-hidden /> {t("Delete")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

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
