"use client";

import { useOptimistic, useTransition } from "react";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { toggleSupplement } from "./actions";

/** One day in the history grid: tap to mark taken or not (fixes a missed or wrong tick). */
export function SupplementDayCell({ supplementId, ownerId, date, taken, label }: { supplementId: string; ownerId: string; date: string; taken: boolean; label: string }) {
  const { toast } = useToast();
  const [shown, setShown] = useOptimistic(taken);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={shown}
      aria-label={`${label}: ${shown ? "taken" : "not taken"}. Tap to change.`}
      title={`${label}: ${shown ? "taken" : "not taken"} (tap to change)`}
      onClick={() =>
        start(async () => {
          setShown(!shown);
          const r = await toggleSupplement(supplementId, ownerId, date, !shown);
          if (r.error) toast(r.error, { tone: "error" });
        })
      }
      className={cx("inline-block size-5 rounded", shown ? "bg-accent" : "bg-surface-2 ring-1 ring-border hover:ring-accent")}
    />
  );
}
