"use client";

import { useOptimistic, useTransition } from "react";
import { cx } from "@/components/ui";
import { TIMING_LABEL } from "@/modules/supplements/meta";
import type { Supplement } from "@/lib/types";
import { toggleSupplement } from "@/app/(app)/supplements/actions";

/** Tap-to-tick checklist for one day. Shared by the page and the Home widget. */
export function SupplementChecklist({
  supplements,
  takenIds,
  ownerId,
  date,
  canWrite,
  grouped = true,
}: {
  supplements: Supplement[];
  takenIds: string[];
  ownerId: string;
  date: string;
  canWrite: boolean;
  grouped?: boolean;
}) {
  const [, start] = useTransition();
  const [taken, setTaken] = useOptimistic(new Set(takenIds), (state, change: { id: string; on: boolean }) => {
    const next = new Set(state);
    if (change.on) next.add(change.id);
    else next.delete(change.id);
    return next;
  });

  const groups = grouped
    ? Object.entries(TIMING_LABEL)
        .map(([timing, label]) => ({ label, items: supplements.filter((s) => s.timing === timing) }))
        .filter((g) => g.items.length)
    : [{ label: "", items: supplements }];

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.label}>
          {g.label ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{g.label}</p> : null}
          <ul className="space-y-1">
            {g.items.map((s) => {
              const on = taken.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!canWrite}
                    aria-pressed={on}
                    onClick={() =>
                      start(async () => {
                        setTaken({ id: s.id, on: !on });
                        await toggleSupplement(s.id, ownerId, date, !on);
                      })
                    }
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
                      on ? "border-accent/40 bg-accent-soft" : "border-border bg-surface hover:bg-surface-2",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cx(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border text-xs",
                        on ? "border-accent bg-accent text-accent-fg" : "border-border",
                      )}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className={cx("flex-1", on && "text-fg-muted line-through")}>{s.name}</span>
                    {s.dose ? <span className="text-xs text-fg-muted">{s.dose}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
