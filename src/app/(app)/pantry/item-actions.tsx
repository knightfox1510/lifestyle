"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { markUsedUp, setRunningLow, setStaple } from "./actions";

/** Used up / Running low / Used up + rebuy, and the staple star, with confirmations. */
export function PantryItemActions({ id, staple, runningLow, groceriesOn }: { id: string; staple: boolean; runningLow: boolean; groceriesOn: boolean }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.error ?? r.message ?? t("Done"), { tone: r.error ? "error" : "ok" });
    });
  return (
    <>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markUsedUp(id, false))}>
        {t("Used up")}
      </Button>
      {groceriesOn && !runningLow ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setRunningLow(id))} title={t("Keep it here and add it to the grocery list")}>
          {t("Running low")}
        </Button>
      ) : null}
      {groceriesOn && !staple ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markUsedUp(id, true))} title={t("Mark used up and add to the grocery list")}>
          {t("Used up + rebuy")}
        </Button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        aria-pressed={staple}
        title={staple ? t("Staple: always re-added to the list when it runs out") : t("Mark as a staple")}
        aria-label={staple ? t("Remove from staples") : t("Mark as a staple")}
        className={cx("pressable grid size-9 place-items-center rounded-full", staple ? "text-sun" : "text-fg-muted hover:bg-surface-2")}
        onClick={() => start(async () => { await setStaple(id, !staple); toast(staple ? t("No longer a staple") : t("Staple: always re-added to the list when it runs out")); })}
      >
        <Star className={cx("size-4", staple && "fill-current")} aria-hidden />
      </button>
    </>
  );
}
