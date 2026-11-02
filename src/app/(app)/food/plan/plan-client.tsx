"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Notice, Select, Textarea, buttonClass, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { shortDate, shortDay } from "@/lib/dates";
import type { GroceryCategory, Meal } from "@/lib/types";
import { MEAL_META } from "@/modules/food/meta";
import { PLAN_MEALS, WEEKDAY_SHORT, mergeIngredients, planDayTotals } from "@/modules/food/plan";
import { addToGroceryList, saveIdeaAsRecipe } from "@/app/(app)/recipes/actions";
import { addPlanEntries, copyPreviousWeek, linkPlanRecipe, logPlannedMeal, removePlanEntry, setPlanPortions, setShoppingDay } from "./actions";

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

/** One planned dish: who it's for and their portions, plus "We ate this", make a recipe, change portions, remove. */
export function PlannedDish({
  entry,
  title,
  recipeHref,
  people,
  canLog,
  weekStart,
  macros,
}: {
  entry: { id: string; for_user: string | null; portions: Record<string, number>; recipe_id: string | null; logged: boolean; servings: number };
  title: string;
  recipeHref: string | null;
  people: PlanPerson[];
  canLog: boolean;
  weekStart: string;
  macros: { kcal: number | null; protein: number | null };
}) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [forUser, setForUser] = useState(entry.for_user ?? "");
  const [portions, setPortions] = useState<Record<string, number>>(entry.portions ?? {});
  const [pending, start] = useTransition();
  const [making, setMaking] = useState(false);

  async function makeRecipe() {
    setMaking(true);
    try {
      const res = await fetch("/api/ai/plan-recipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, servings: Math.max(1, Math.min(12, entry.servings)) }) });
      const idea = await res.json();
      if (!res.ok) throw new Error(idea.error ?? "Couldn't write the recipe");
      const saved = await saveIdeaAsRecipe(idea);
      if (saved.error || !saved.id) throw new Error(saved.error ?? "Couldn't save the recipe");
      const r = await linkPlanRecipe(title, saved.id, weekStart);
      toast(r.error ?? t("Recipe saved and linked to the plan."), r.error ? { tone: "error" } : undefined);
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
    } finally {
      setMaking(false);
    }
  }

  return (
    <div className={cx("rounded-md", pending && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 truncate text-left" aria-expanded={open}>
          {entry.logged ? "✓ " : ""}
          {title}
          <span className="block truncate text-[11px] text-fg-muted">
            {people.length > 1 ? portionsLabel(entry.for_user, entry.portions, people) : `${entry.portions?.[people[0]?.id] ?? 1}×`}
            {macros.kcal != null ? ` · ${macros.kcal} kcal${macros.protein != null ? ` · P ${Math.round(macros.protein)}` : ""}/serving` : ""}
          </span>
        </button>
        <RemovePlanned id={entry.id} label={title} />
      </div>
      {open ? (
        <div className="mt-1.5 space-y-2 rounded-lg border border-border bg-surface-2/50 p-2 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {canLog && !entry.logged ? (
              <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await logPlannedMeal(entry.id); toast(r.error ?? r.message ?? "Logged.", r.error ? { tone: "error" } : undefined); })}>
                ✓ {t("We ate this")}
              </Button>
            ) : null}
            {recipeHref ? (
              <a href={recipeHref} className={cx(buttonClass("secondary", "sm"))}>📖 {t("Recipe")}</a>
            ) : (
              <Button size="sm" variant="secondary" disabled={making} onClick={makeRecipe}>{making ? t("Writing recipe…") : `📖 ${t("Make a recipe")}`}</Button>
            )}
          </div>
          {people.length > 1 ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-fg-muted">{t("For")}</span>
                {[{ id: "", name: t("Everyone") }, ...people].map((p) => (
                  <button key={p.id || "all"} type="button" onClick={() => setForUser(p.id)} aria-pressed={forUser === p.id} className={cx("rounded-full border px-2.5 py-0.5", forUser === p.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
                    {p.id ? first(p.name) : p.name}
                  </button>
                ))}
              </div>
              {(forUser ? people.filter((p) => p.id === forUser) : people).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-16 truncate text-fg-muted">{first(p.name)}</span>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => (
                    <button key={v} type="button" onClick={() => setPortions({ ...portions, [p.id]: v })} aria-pressed={(portions[p.id] ?? 1) === v} className={cx("rounded-full border px-2 py-0.5 tabular-nums", (portions[p.id] ?? 1) === v ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
                      {v}×
                    </button>
                  ))}
                </div>
              ))}
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await setPlanPortions(entry.id, { for_user: forUser || null, portions }); toast(r.error ?? t("Saved."), r.error ? { tone: "error" } : undefined); if (!r.error) setOpen(false); })}>
                {t("Save portions")}
              </Button>
            </div>
          ) : null}
        </div>
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
export function SlotAdd({ date, meal, usuals, recipes, servings, people }: { date: string; meal: Meal; usuals: string[]; recipes: { id: string; title: string }[]; servings: number; people: PlanPerson[] }) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [forUser, setForUser] = useState<string>("");
  const [pending, start] = useTransition();
  const add = (entry: { title?: string; recipe_id?: string }) =>
    start(async () => {
      const r = await addPlanEntries([{ plan_date: date, meal, servings: forUser ? 1 : servings, for_user: forUser || null, ...entry }]);
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
      {people.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-fg-muted">{t("For")}</span>
          {[{ id: "", name: t("Everyone") }, ...people].map((p) => (
            <button key={p.id || "all"} type="button" onClick={() => setForUser(p.id)} aria-pressed={forUser === p.id} className={cx("rounded-full border px-2.5 py-0.5", forUser === p.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
              {p.id ? first(p.name) : p.name}
            </button>
          ))}
        </div>
      ) : null}
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

export type PlanPerson = { id: string; name: string; kcal: number | null; protein: number | null };

type Suggested = {
  date: string;
  meal: Meal;
  title: string;
  recipe_id: string | null;
  for_user: string | null;
  portions: Record<string, number>;
  servings: number;
  usual: boolean;
  kcal_per_serving: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: ShopItem[];
  keep: boolean;
};

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/** "Gaurav 1.5× · Kari 1×" or "Kari only · 1×". */
export function portionsLabel(forUser: string | null | undefined, portions: Record<string, number> | null | undefined, people: { id: string; name: string }[]) {
  const eaters = forUser ? people.filter((p) => p.id === forUser) : people;
  const list = eaters.map((p) => `${first(p.name)} ${portions?.[p.id] ?? 1}×`).join(" · ");
  return forUser ? `${first(eaters[0]?.name ?? "")} only · ${portions?.[forUser] ?? 1}×` : list;
}

/** AI fills the empty slots from your usual meals, sized to each person's goals, and builds the shopping list from the meals you keep. */
export function AiWeekPlanner({ weekStart, groceriesOn, learnedFrom, people }: { weekStart: string; groceriesOn: boolean; learnedFrom: number; people: PlanPerson[] }) {
  const t = useT();
  const { toast } = useToast();
  const [meals, setMeals] = useState<Meal[]>(["breakfast", "lunch", "dinner"]);
  const [variety, setVariety] = useState<"usual" | "mix" | "new">("mix");
  const [separate, setSeparate] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ meals: Suggested[]; note: string | null } | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [saving, start] = useTransition();

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/week-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekStart, meals, variety, separate, notes: notes || undefined }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Planning failed");
      setPlan({ meals: (body.meals as Omit<Suggested, "keep">[]).map((m) => ({ ...m, keep: true })), note: body.note });
      setSkip(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const kept = plan ? plan.meals.filter((m) => m.keep) : [];
  // The shopping list follows your selection: untick a dish and its ingredients drop out.
  const shopping = mergeIngredients(kept.map((m) => m.ingredients)) as ShopItem[];
  const shop = shopping.filter((s) => !skip.has(s.name));

  // Planned calories/protein per person per day (from what's kept).
  const dayTotals = (d: string) => {
    const ids = people.map((p) => p.id);
    return planDayTotals(kept.filter((m) => m.date === d), ids, new Map());
  };

  function save() {
    if (!plan) return;
    start(async () => {
      if (kept.length) {
        const r = await addPlanEntries(
          kept.map((m) => ({
            plan_date: m.date,
            meal: m.meal,
            title: m.recipe_id ? null : m.title,
            recipe_id: m.recipe_id,
            servings: m.servings,
            for_user: m.for_user,
            portions: m.portions,
            kcal_per_serving: m.kcal_per_serving,
            protein_g: m.protein_g,
            carbs_g: m.carbs_g,
            fat_g: m.fat_g,
            ingredients: m.ingredients,
          })),
        );
        if (r.error) return void toast(r.error, { tone: "error" });
      }
      let msg = t("Planned {n} meals.", { n: kept.length });
      if (groceriesOn && shop.length) {
        const g = await addToGroceryList(shop.map(({ name, quantity, category }) => ({ name, quantity, category })));
        msg += ` ${g.error ?? g.message ?? ""}`;
      }
      toast(msg);
      setPlan(null);
    });
  }

  const days = plan ? [...new Set(plan.meals.map((m) => m.date))].sort() : [];
  const update = (i: number, patch: Partial<Suggested>) => plan && setPlan({ ...plan, meals: plan.meals.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">✨ {t("Plan my week")}</h2>
        <p className="text-xs text-fg-muted">
          {learnedFrom
            ? t("Fills the empty slots using what you usually eat ({n} meals logged in the last 8 weeks), your recipes and pantry, then makes one shopping list.", { n: learnedFrom })
            : t("Log a few meals in the food diary and this gets better: it learns what you usually eat.")}
        </p>
        {people.length > 1 ? (
          <p className="mt-1 text-xs text-fg-muted">
            {people.map((p) => `${first(p.name)}: ${p.kcal ? `${p.kcal.toLocaleString("en-IN")} kcal${p.protein ? `, ${p.protein} g protein` : ""}` : t("no goal set")}`).join(" · ")}. {t("Portions are sized to each person's goal.")}
          </p>
        ) : null}
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
          {people.length > 1 ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
              <span>
                {t("Separate dishes when our goals differ")}
                <span className="block text-xs text-fg-muted">{t("e.g. a higher-protein lunch for one of you, or one without bladder irritants. Otherwise you share every dish with your own portions.")}</span>
              </span>
            </label>
          ) : null}
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="min-h-12" placeholder={t("Anything this week? e.g. “guests on Saturday”, “no fish”, “light dinners”")} />
          <Button onClick={run} disabled={loading || !meals.length}>{loading ? t("Planning the week…") : `✨ ${t("Plan the empty slots")}`}</Button>
          {error ? <Notice tone="danger">{error}</Notice> : null}
        </>
      ) : (
        <div className="space-y-3">
          {plan.note ? <p className="text-sm text-fg-muted">{plan.note}</p> : null}
          {plan.meals.length === 0 ? <p className="text-sm text-fg-muted">{t("No suggestions came back. Try again.")}</p> : null}
          <div className="space-y-3">
            {days.map((d) => {
              const totals = dayTotals(d);
              return (
                <div key={d}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t(shortDay(d))} {shortDate(d)}</p>
                    <p className="text-[11px] text-fg-muted">
                      {people.map((p) => `${first(p.name)} ~${totals[p.id]?.kcal.toLocaleString("en-IN") ?? 0} kcal · ${totals[p.id]?.protein ?? 0} g P`).join("  ·  ")}
                    </p>
                  </div>
                  <ul className="mt-1 space-y-1.5">
                    {plan.meals.map((m, i) =>
                      m.date !== d ? null : (
                        <li key={i} className={cx("rounded-lg border border-border p-2 text-sm", !m.keep && "opacity-50")}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={m.keep} onChange={(e) => update(i, { keep: e.target.checked })} aria-label={m.title} />
                            <span aria-hidden>{MEAL_META[m.meal].icon}</span>
                            <Input value={m.title} disabled={Boolean(m.recipe_id)} onChange={(e) => update(i, { title: e.target.value })} className="!h-8 flex-1" aria-label={t(MEAL_META[m.meal].label)} />
                            {m.usual ? <span className="shrink-0 text-xs text-fg-muted">{t("usual")}</span> : <span className="shrink-0 text-xs text-accent">{t("new")}</span>}
                          </div>
                          <p className="mt-1 pl-6 text-xs text-fg-muted">
                            {portionsLabel(m.for_user, m.portions, people)} · {m.kcal_per_serving} kcal, P {Math.round(m.protein_g)} g {t("per serving")}
                          </p>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
          {shopping.length ? (
            <details open className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold">🛒 {t("Shopping list")} ({shop.length})</summary>
              <p className="mt-1 text-xs text-fg-muted">{t("From the dishes you've kept, minus what's in the pantry.")}</p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {shopping.map((s) => (
                  <li key={s.name} className={cx("flex items-center gap-2 text-sm", skip.has(s.name) && "opacity-50")}>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={!skip.has(s.name)}
                      onChange={(e) => { const n = new Set(skip); if (e.target.checked) n.delete(s.name); else n.add(s.name); setSkip(n); }}
                      aria-label={s.name}
                    />
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
