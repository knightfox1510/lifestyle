"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Button, Input, Notice } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { ActionResult } from "@/lib/types";
import { quickLog } from "@/app/(app)/bladder/actions";
import { quickAddGrocery } from "@/app/(app)/groceries/actions";
import { logBodyMetric } from "@/app/(app)/body/actions";
import { useT } from "@/lib/i18n/client";

export function BladderQuickButtons({ ownerId, counts }: { ownerId: string; counts: { leaks: number; voids: number; fluidMl: number } }) {
  const [pending, start] = useTransition();
  const t = useT();
  const [state, run] = useActionState(async (_: ActionResult | null, what: "leak" | "urge" | "void" | "water") => quickLog(ownerId, what), null);
  const buttons = [
    { what: "leak", label: `💧 ${t("Leak")}` },
    { what: "urge", label: `⚡ ${t("Urge")}` },
    { what: "void", label: `🚻 ${t("Bathroom")}` },
    { what: "water", label: "🥤 +250 ml" },
  ] as const;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {buttons.map((b) => (
          <Button key={b.what} size="sm" variant="secondary" className="!h-11 !px-1 text-xs" disabled={pending} onClick={() => start(() => run(b.what))}>
            {b.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-fg-muted">
        {t("Today: {leaks} leaks · {voids} bathroom · {ml} ml.", { leaks: counts.leaks, voids: counts.voids, ml: counts.fluidMl })}{" "}
        <Link href="/bladder" className="text-accent hover:underline">{t("Add details")}</Link>
      </p>
      {state?.error ? <Notice tone="danger">{state.error}</Notice> : <ActionMessage state={state} />}
    </div>
  );
}

export function GroceryQuickAdd() {
  const [state, action] = useActionState(quickAddGrocery, null);
  const t = useT();
  return (
    <form action={action} className="space-y-1.5">
      <div className="flex gap-2">
        <Input name="name" placeholder={t("Add to list…")} aria-label="Grocery item" maxLength={120} required />
        <SubmitButton pendingText="…">{t("Add")}</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function QuickWeighIn({ ownerId, last }: { ownerId: string; last: number | null }) {
  const [state, action] = useActionState(logBodyMetric, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="ownerId" value={ownerId} />
      <div className="flex gap-2">
        <Input name="weight_kg" type="number" step="0.1" min={20} max={350} placeholder={last ? String(last) : "kg"} aria-label="Weight in kg" required />
        <SubmitButton pendingText="…">Log</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
