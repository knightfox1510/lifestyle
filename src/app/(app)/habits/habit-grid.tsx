"use client";

import { useOptimistic, useTransition } from "react";
import { cx } from "@/components/ui";
import type { Habit } from "@/lib/types";
import { toggleHabit } from "@/app/(app)/habits/actions";

/** Habit rows with tappable day cells. Used by the page (7 days) and the widget (today only). */
export function HabitGrid({
  habits,
  done,
  days,
  dayLabels,
  ownerId,
  canWrite,
}: {
  habits: Habit[];
  done: string[]; // "habitId|date"
  days: string[];
  dayLabels: string[];
  ownerId: string;
  canWrite: boolean;
}) {
  const [, start] = useTransition();
  const [set, update] = useOptimistic(new Set(done), (s, c: { key: string; on: boolean }) => {
    const n = new Set(s);
    if (c.on) n.add(c.key);
    else n.delete(c.key);
    return n;
  });

  return (
    <table className="w-full text-sm">
      {days.length > 1 ? (
        <thead>
          <tr className="text-xs text-fg-muted">
            <th />
            {dayLabels.map((l, i) => (
              <th key={days[i]} className="pb-1 font-normal">{l}</th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {habits.map((h) => (
          <tr key={h.id}>
            <td className="py-1 pr-2">
              <span aria-hidden>{h.icon}</span> {h.name}
            </td>
            {days.map((d) => {
              const key = `${h.id}|${d}`;
              const on = set.has(key);
              return (
                <td key={d} className="w-10 py-1 text-center">
                  <button
                    type="button"
                    disabled={!canWrite}
                    aria-pressed={on}
                    aria-label={`${h.name} ${d}`}
                    onClick={() =>
                      start(async () => {
                        update({ key, on: !on });
                        await toggleHabit(h.id, ownerId, d, !on);
                      })
                    }
                    className={cx(
                      "size-8 rounded-lg text-sm transition",
                      on ? "bg-accent text-accent-fg" : "bg-surface-2 text-transparent hover:text-fg-muted",
                    )}
                  >
                    ✓
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
