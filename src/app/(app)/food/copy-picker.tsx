"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import type { Meal } from "@/lib/types";
import { copyEntries, undoFoodEntries } from "./actions";

export type CopySource = { key: string; label: string; who: string | null; items: { id: string; description: string; quantity: string | null; calories: number | null }[] };

const PORTIONS: [number, string][] = [[0.5, "½×"], [0.75, "¾×"], [1, "1×"], [1.25, "1¼×"], [1.5, "1½×"], [2, "2×"]];

/**
 * "Copy Kari's lunch" / "Same as yesterday": tick the items you had, pick
 * your portion, add them in one tap (with Undo).
 */
export function CopyPicker({ source, ownerId, meal, date, onDone }: { source: CopySource; ownerId: string; meal: Meal; date: string; onDone?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(source.items.map((i) => i.id));
  const [factor, setFactor] = useState(1);
  const [pending, start] = useTransition();
  const kcal = Math.round(source.items.filter((i) => picked.includes(i.id)).reduce((a, i) => a + Number(i.calories ?? 0), 0) * factor);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-accent/50 px-3 py-2 text-left text-sm hover:bg-accent-soft">
        <Copy className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <strong className="font-medium">{source.label}</strong>
          <span className="text-fg-muted">: {source.items.map((i) => i.description).join(", ")}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-accent/40 bg-accent-soft/40 p-3 [animation:toast-in_.2s_ease-out]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{source.label}</p>
        <button type="button" className="text-xs text-fg-muted" onClick={() => setOpen(false)}>Close</button>
      </div>
      <ul className="space-y-1">
        {source.items.map((i) => (
          <li key={i.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={picked.includes(i.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))} />
              <span className="min-w-0 flex-1 truncate">{i.description}{i.quantity ? <span className="text-fg-muted"> · {i.quantity}</span> : null}</span>
              <span className="shrink-0 text-xs tabular-nums text-fg-muted">{i.calories != null ? `${Math.round(Number(i.calories) * factor)} kcal` : ""}</span>
            </label>
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-1 text-xs text-fg-muted">{source.who ? `Your portion compared with ${source.who}'s` : "Portion"}</p>
        <div className="flex flex-wrap gap-1">
          {PORTIONS.map(([f, label]) => (
            <button key={f} type="button" onClick={() => setFactor(f)} aria-pressed={factor === f} className={cx("rounded-lg px-2.5 py-1 text-sm", factor === f ? "bg-accent font-semibold text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <Button
        size="sm"
        pending={pending}
        disabled={!picked.length}
        onClick={() =>
          start(async () => {
            const r = await copyEntries({ entryIds: picked, toOwner: ownerId, meal, toDate: date, factor });
            if (r.error) return toast(r.error, { tone: "error" });
            toast(r.message ?? "Added.", { kind: "food", undo: r.ids?.length ? () => undoFoodEntries(r.ids!, ownerId) : undefined });
            setOpen(false);
            onDone?.();
          })
        }
      >
        Add {picked.length} item{picked.length === 1 ? "" : "s"} · {kcal.toLocaleString("en-IN")} kcal
      </Button>
    </div>
  );
}
