"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { moveProgress, rateItem } from "./actions";

export function ProgressControls({ itemId, isSeries }: { itemId: string; isSeries: boolean }) {
  const [pending, start] = useTransition();
  if (!isSeries) return null;
  return (
    <div className="flex gap-1">
      <Button size="sm" disabled={pending} onClick={() => start(() => moveProgress(itemId, { episodeDelta: 1 }))}>+1 episode</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => moveProgress(itemId, { episodeDelta: -1 }))} aria-label="Back one episode">−1</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => moveProgress(itemId, { nextSeason: true }))}>Next season</Button>
    </div>
  );
}

export function Stars({ itemId, value }: { itemId: string; value: number | null }) {
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={value === n}
          disabled={pending}
          onClick={() => start(() => rateItem(itemId, n))}
          className={`px-0.5 text-base ${value && n <= value ? "text-series-2" : "text-fg-muted/40"}`}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
