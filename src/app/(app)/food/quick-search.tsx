"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Card, Input, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import type { FoodHit, PersonPortion } from "@/components/nutrition-ui";
import type { Meal } from "@/lib/types";
import { MEAL_META, eatenAtFor, mealForHour, type LogDay } from "@/modules/food/meta";
import type { Nutrients } from "@/modules/nutrition/nutrients";
import { FoodAmountLogger } from "./food-logger";
import { repeatFood } from "./actions";

export type RecentFood = { id: string; description: string; quantity: string | null; calories: number | null; meal: Meal };

/**
 * One search for everything you can log: what you've had recently (one tap
 * logs it again), your foods, recipes, Indian dishes, built-in staples and
 * USDA. Pick one → choose the amount → log. Nothing has to be saved first.
 */
export function FoodQuickSearch({ ownerId, people, day, meal, recent, compact }: { ownerId: string; people: PersonPortion[]; day: LogDay; meal?: Meal; recent: RecentFood[]; compact?: boolean }) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const targetMeal = meal ?? mealForHour(new Date().getHours());

  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = ++seq.current;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/food/search?q=${encodeURIComponent(q.trim())}`);
        const body = await res.json();
        if (id === seq.current) setHits(body.results ?? []);
      } catch {
        if (id === seq.current) setHits([]);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const query = q.trim().toLowerCase();
  const recentHits = query.length >= 2 ? recent.filter((r) => r.description.toLowerCase().includes(query)).slice(0, 4) : [];
  // With an empty box inside a meal card, offer what's usually had at that meal.
  const usual = !query && meal ? recent.filter((r) => r.meal === meal).slice(0, 6) : [];

  const again = (r: RecentFood) =>
    start(async () => {
      await repeatFood(r.id, ownerId, targetMeal, eatenAtFor(day, targetMeal));
      toast(`${r.description} added to ${MEAL_META[targetMeal].label}`);
      setQ("");
    });

  if (picked) {
    const per100 = picked.per100 ?? picked.perServing ?? {};
    const servingG = picked.per100 ? (picked.servingG ?? null) : 100;
    return (
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{picked.name} <span className="text-xs font-normal text-fg-muted">· {picked.source}</span></p>
          <button type="button" onClick={() => setPicked(null)} className="rounded p-1 text-fg-muted hover:text-fg" aria-label="Back to search"><X className="size-4" aria-hidden /></button>
        </div>
        <FoodAmountLogger
          key={`${picked.name}-${meal ?? ""}`}
          name={picked.name}
          per100={per100 as Nutrients}
          servingG={servingG}
          servingLabel={picked.per100 ? null : "1 serving"}
          irritants={picked.irritants}
          accuracy={picked.ref.kind === "custom" ? "label" : "calculated"}
          me={ownerId}
          people={people}
          meal={targetMeal}
          day={day}
          onLogged={() => { setPicked(null); setQ(""); }}
        />
      </Card>
    );
  }

  return (
    <div className={cx("space-y-1.5", compact ? "" : "rounded-2xl")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={meal ? `Search to add to ${MEAL_META[meal].label.toLowerCase()}…` : "Search foods you've had, your foods, dishes…"} className="!pl-9" aria-label="Search foods to log" />
      </div>
      {usual.length ? (
        <div className="flex flex-wrap gap-1.5">
          {usual.map((r) => (
            <button key={r.id} type="button" disabled={pending} onClick={() => again(r)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent">
              + {r.description}{r.calories != null ? <span className="text-fg-muted"> {r.calories}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {loading ? <p className="text-xs text-fg-muted">Searching…</p> : null}
      {query.length >= 2 && (recentHits.length || hits.length) ? (
        <ul className="max-h-72 divide-y divide-border overflow-auto rounded-xl border border-border bg-surface text-sm">
          {recentHits.map((r) => (
            <li key={`r-${r.id}`}>
              <button type="button" disabled={pending} onClick={() => again(r)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-2">
                <span className="min-w-0 truncate">{r.description}{r.quantity ? <span className="text-fg-muted"> · {r.quantity}</span> : null}</span>
                <span className="shrink-0 text-xs text-accent">recent · {r.calories ?? "–"} kcal · tap to add</span>
              </button>
            </li>
          ))}
          {hits.map((h, i) => (
            <li key={`${h.ref.kind}-${"key" in h.ref ? h.ref.key : h.ref.id}-${i}`}>
              <button type="button" onClick={() => setPicked(h)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-2">
                <span className="min-w-0 truncate">{h.name}</span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {h.perServing?.calories != null ? `${Math.round(h.perServing.calories)} kcal/serving` : h.per100?.calories != null ? `${Math.round(h.per100.calories)} kcal/100 g` : ""} · {h.source}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : query.length >= 2 && !loading ? (
        <p className="text-xs text-fg-muted">Nothing found. Describe it in the box below and AI will work it out.</p>
      ) : null}
    </div>
  );
}
