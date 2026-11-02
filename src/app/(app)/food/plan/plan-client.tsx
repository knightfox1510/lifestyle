"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Notice, Select, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { shortDate, shortDay } from "@/lib/dates";
import type { GroceryCategory, Meal } from "@/lib/types";
import { MEAL_META } from "@/modules/food/meta";
import { PLAN_MEALS, WEEKDAY_SHORT } from "@/modules/food/plan";
import { addToGroceryList } from "@/app/(app)/recipes/actions";
import { addPlanEntries, copyPreviousWeek, removePlanEntry, setShoppingDay } from "./actions";

type ShopItem = { name: string; quantity: string | null; category: GroceryCategory };

export function ShoppingDayPicker({ day }: { day: number }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(day);
  const pick = (d: number) => {
    setValue(d);
    start(async () => {
      const r = await setShoppingDay(d);
      if (r.error) {
        setValue(day);
        toast(r.error, { tone: "error" });
      } else toast(t("Your week now starts on {day}", { day: t(WEEKDAY_SHORT[d]) }));
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-fg-muted">🛒 {t("We shop on")}</span>
      {[6, 0].map((d) => (
        <button
          key={d}
          type="button"
          disabled={pending}
          onClick={() => pick(d)}
          aria-pressed={value === d}
          className={cx("rounded-full border px-3 py-1 font-medium transition", value === d ? "border-accent bg-accent text-accent-fg" : "border-border hover:bg-surface-2")}
        >
          {t(d === 6 ? "Saturday" : "Sunday")}
        </button>
      ))}
      {value !== 6 && value !== 0 ? (
        <Select value={value} onChange={(e) => pick(Number(e.target.value))} className="!h-8 w-24" aria-label={t("Shopping day")}>
          {WEEKDAY_SHORT.map((d, i) => (
            <option key={d} value={i}>{t(d)}</option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}

export function RemovePlanned({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { const r = await removePlanEntry(id); if (r.error) toast(r.error, { tone: "error" }); })}
      className={cx("shrink-0 rounded p-0.5 text-fg-muted hover:text-danger", pending && "opacity-40")}
      aria-label={`Remove ${label}`}
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

/** "+" on a day's meal: one tap on a usual dish, or type one, or pick a saved recipe. */
export function SlotAdd({ date, meal, usuals, recipes, servings }: { date: string; meal: Meal; usuals: string[]; recipes: { id: string; title: string }[]; servings: number }) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const add = (entry: { title?: string; recipe_id?: string }) =>
    start(async () => {
      const r = await addPlanEntries([{ plan_date: date, meal, servings, ...entry }]);
      if (r.error) toast(r.error, { tone: "error" });
      else {
        setText("");
        setOpen(false);
      }
    });
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-fg-muted hover:text-accent" aria-label={t("Add to {meal}", { meal: t(MEAL_META[meal].label) })}>
        <Plus className="size-3.5" aria-hidden /> {t("Add")}
      </button>
    );
  }
  return (
    <div className={cx("mt-1 space-y-2 rounded-lg border border-border bg-surface-2/50 p-2", pending && "opacity-60")}>
      {usuals.length ? (
        <div className="flex flex-wrap gap-1.5">
          {usuals.map((u) => (
            <button key={u} type="button" disabled={pending} onClick={() => add({ title: u })} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:border-accent hover:text-accent">
              + {u}
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) add({ title: text.trim() }); }} className="flex gap-1.5">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Type a dish")} maxLength={150} className="!h-8 flex-1 text-sm" autoFocus />
        <Button size="sm" type="submit" disabled={pending || !text.trim()}>{t("Add")}</Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>{t("Close")}</Button>
      </form>
      {recipes.length ? (
        <Select value="" onChange={(e) => e.target.value && add({ recipe_id: e.target.value })} className="!h-8 text-sm" aria-label={t("Saved recipe")}>
          <option value="">{t("Or pick a saved recipe…")}</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}

export function CopyWeekButton({ weekStart }: { weekStart: string }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => { const r = await copyPreviousWeek(weekStart); toast(r.error ?? r.message ?? t("Done"), r.error ? { tone: "error" } : undefined); })}>
      {pending ? "…" : `↻ ${t("Copy last week")}`}
    </Button>
  );
}

export function GroceryListButton({ items, label }: { items: ShopItem[]; label: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  if (!items.length) return null;
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await addToGroceryList(items); toast(r.error ?? r.message ?? "Added.", r.error ? { tone: "error" } : undefined); })}>
      🛒 {label}
    </Button>
  );
}

type Suggested = { date: string; meal: Meal; title: string; recipe_id: string | null; servings: number; usual: boolean; keep: boolean };

/** AI fills the empty slots of the week from the household's usual meals, recipes and pantry, plus a shopping list. */
export function AiWeekPlanner({ weekStart, groceriesOn, learnedFrom }: { weekStart: string; groceriesOn: boolean; learnedFrom: number }) {
  const t = useT();
  const { toast } = useToast();
  const [meals, setMeals] = useState<Meal[]>(["breakfast", "lunch", "dinner"]);
  const [variety, setVariety] = useState<"usual" | "mix" | "new">("mix");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ meals: Suggested[]; shopping: (ShopItem & { keep: boolean })[]; note: string | null } | null>(null);
  const [saving, start] = useTransition();

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/week-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekStart, meals, variety, notes: notes || undefined }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Planning failed");
      setPlan({
        meals: (body.meals as Omit<Suggested, "keep">[]).map((m) => ({ ...m, keep: true })),
        shopping: (body.shopping as ShopItem[]).map((s) => ({ ...s, keep: true })),
        note: body.note,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!plan) return;
    const chosen = plan.meals.filter((m) => m.keep);
    const shop = plan.shopping.filter((s) => s.keep);
    start(async () => {
      if (chosen.length) {
        const r = await addPlanEntries(chosen.map((m) => ({ plan_date: m.date, meal: m.meal, title: m.recipe_id ? null : m.title, recipe_id: m.recipe_id, servings: m.servings })));
        if (r.error) return void toast(r.error, { tone: "error" });
      }
      let msg = t("Planned {n} meals.", { n: chosen.length });
      if (groceriesOn && shop.length) {
        const g = await addToGroceryList(shop.map(({ name, quantity, category }) => ({ name, quantity, category })));
        msg += ` ${g.error ?? g.message ?? ""}`;
      }
      toast(msg);
      setPlan(null);
    });
  }

  const days = plan ? [...new Set(plan.meals.map((m) => m.date))].sort() : [];

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">✨ {t("Plan my week")}</h2>
        <p className="text-xs text-fg-muted">
          {learnedFrom
            ? t("Fills the empty slots using what you usually eat ({n} meals logged in the last 8 weeks), your recipes and pantry, then makes one shopping list.", { n: learnedFrom })
            : t("Log a few meals in the food diary and this gets better: it learns what you usually eat.")}
        </p>
      </div>
      {!plan ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PLAN_MEALS.map((m) => {
              const on = meals.includes(m);
              return (
                <button key={m} type="button" aria-pressed={on} onClick={() => setMeals(on ? meals.filter((x) => x !== m) : [...meals, m])} className={cx("rounded-full border px-3 py-1 text-sm", on ? "border-accent bg-accent-soft text-accent" : "border-border text-fg-muted")}>
                  {MEAL_META[m].icon} {t(MEAL_META[m].label)}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 text-sm">
            {(
              [
                ["usual", "Our usuals"],
                ["mix", "Mix it up"],
                ["new", "Try new"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setVariety(v)} className={cx("rounded-lg py-1.5 font-medium", variety === v ? "bg-surface shadow-sm" : "text-fg-muted")}>
                {t(label)}
              </button>
            ))}
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="min-h-12" placeholder={t("Anything this week? e.g. “guests on Saturday”, “no fish”, “light dinners”")} />
          <Button onClick={run} disabled={loading || !meals.length}>{loading ? t("Planning the week…") : `✨ ${t("Plan the empty slots")}`}</Button>
          {error ? <Notice tone="danger">{error}</Notice> : null}
        </>
      ) : (
        <div className="space-y-3">
          {plan.note ? <p className="text-sm text-fg-muted">{plan.note}</p> : null}
          {plan.meals.length === 0 ? <p className="text-sm text-fg-muted">{t("No suggestions came back. Try again.")}</p> : null}
          <div className="space-y-2">
            {days.map((d) => (
              <div key={d}>
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t(shortDay(d))} {shortDate(d)}</p>
                <ul className="mt-1 space-y-1">
                  {plan.meals.map((m, i) =>
                    m.date !== d ? null : (
                      <li key={i} className={cx("flex items-center gap-2 text-sm", !m.keep && "opacity-50")}>
                        <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={m.keep} onChange={(e) => setPlan({ ...plan, meals: plan.meals.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)) })} aria-label={m.title} />
                        <span aria-hidden>{MEAL_META[m.meal].icon}</span>
                        <Input value={m.title} disabled={Boolean(m.recipe_id)} onChange={(e) => setPlan({ ...plan, meals: plan.meals.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className="!h-8 flex-1" aria-label={t(MEAL_META[m.meal].label)} />
                        {m.usual ? <span className="shrink-0 text-xs text-fg-muted">{t("usual")}</span> : <span className="shrink-0 text-xs text-accent">{t("new")}</span>}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
          {plan.shopping.length ? (
            <details open className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold">🛒 {t("Shopping list")} ({plan.shopping.filter((s) => s.keep).length})</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {plan.shopping.map((s, i) => (
                  <li key={i} className={cx("flex items-center gap-2 text-sm", !s.keep && "opacity-50")}>
                    <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={s.keep} onChange={(e) => setPlan({ ...plan, shopping: plan.shopping.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)) })} aria-label={s.name} />
                    {s.name}
                    {s.quantity ? <span className="text-fg-muted">· {s.quantity}</span> : null}
                  </li>
                ))}
              </ul>
              {!groceriesOn ? <p className="mt-2 text-xs text-fg-muted">{t("Turn on Groceries in Settings → Household to send this to your list.")}</p> : null}
            </details>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "…" : groceriesOn ? t("Add to plan and grocery list") : t("Add to plan")}</Button>
            <Button variant="secondary" onClick={run} disabled={loading || saving}>{loading ? "…" : t("Try again")}</Button>
            <Button variant="ghost" onClick={() => setPlan(null)}>{t("Cancel")}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
