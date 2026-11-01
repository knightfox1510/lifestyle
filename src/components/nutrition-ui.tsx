"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Input, cx } from "@/components/ui";
import type { FoodRef } from "@/lib/types";
import type { Nutrients } from "@/modules/nutrition/nutrients";

export type FoodHit = { ref: FoodRef; name: string; source: string; per100: Nutrients | null; perServing?: Nutrients | null; servingG?: number | null; irritants: string[] };

export function AccuracyBadge({ accuracy }: { accuracy: "calculated" | "label" | "estimated" | undefined }) {
  if (accuracy === "calculated") return <Badge tone="accent">✓ calculated</Badge>;
  if (accuracy === "label") return <Badge tone="accent">✓ from label</Badge>;
  return <Badge tone="warn">~ estimate</Badge>;
}

/** Search your foods, recipes, built-in staples and USDA. */
export function FoodSearch({ onPick, placeholder = "Search a food (e.g. paneer, toor dal, oats)", autoFocus }: { onPick: (f: FoodHit) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

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
    }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const shown = q.trim().length < 2 ? [] : hits;
  return (
    <div className="space-y-1">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Search foods" autoFocus={autoFocus} className="!h-9" />
      {loading ? <p className="text-xs text-fg-muted">Searching…</p> : null}
      {shown.length ? (
        <ul className="max-h-56 divide-y divide-border overflow-auto rounded-lg border border-border bg-surface text-sm">
          {shown.map((h, i) => (
            <li key={`${h.ref.kind}-${"key" in h.ref ? h.ref.key : h.ref.id}-${i}`}>
              <button type="button" onClick={() => { onPick(h); setQ(""); setHits([]); }} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-surface-2">
                <span className="min-w-0 truncate">{h.name}</span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {h.per100?.calories != null ? `${Math.round(h.per100.calories)} kcal/100 g` : h.perServing?.calories != null ? `${Math.round(h.perServing.calories)} kcal/serving` : ""} · {h.source}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type PersonPortion = { id: string; name: string };
const FACTORS = [0, 0.5, 0.75, 1, 1.25, 1.5, 2];

/** "Who ate this?": one portion size per person (0 = didn't eat). */
export function PeoplePortions({ people, value, onChange, unit = "portion" }: { people: PersonPortion[]; value: Record<string, number>; onChange: (v: Record<string, number>) => void; unit?: "portion" | "serving" }) {
  if (people.length < 2) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Who ate this?</p>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <label key={p.id} className={cx("flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm", value[p.id] ? "border-accent bg-accent-soft" : "border-border")}>
            {p.name}
            <select
              className="rounded bg-transparent text-sm"
              value={String(value[p.id] ?? 0)}
              onChange={(e) => onChange({ ...value, [p.id]: Number(e.target.value) })}
              aria-label={`${p.name}'s ${unit}`}
            >
              {FACTORS.map((f) => (
                <option key={f} value={f}>
                  {f === 0 ? "didn't eat" : unit === "serving" ? `${f} serving${f === 1 ? "" : "s"}` : f === 1 ? "same portion" : `${f}×`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
