"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { quickLog } from "@/app/(app)/bladder/actions";
import { quickAddGrocery } from "@/app/(app)/groceries/actions";
import { logBodyMetric } from "@/app/(app)/body/actions";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/toaster";
import { undoQuickLog } from "@/lib/quick-actions";
import { useRouter } from "next/navigation";

export function BladderQuickButtons({ ownerId, counts }: { ownerId: string; counts: { leaks: number; voids: number; fluidMl: number } }) {
  const [pending, start] = useTransition();
  const t = useT();
  const { toast } = useToast();
  const router = useRouter();
  const buttons = [
    { what: "leak", label: t("Leak") },
    { what: "urge", label: t("Urge") },
    { what: "void", label: t("Bathroom") },
    { what: "water", label: "+250 ml" },
  ] as const;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {buttons.map((b) => (
          <Button
            key={b.what}
            size="sm"
            variant="secondary"
            className="!h-11 !rounded-2xl !px-1 text-xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await quickLog(ownerId, b.what);
                if (r.error) return toast(r.error, { tone: "error" });
                toast(t("{what} logged", { what: b.label }), { undo: r.id ? () => undoQuickLog(b.what === "water" ? "water" : "bladder", r.id!).then(() => router.refresh()) : undefined });
              })
            }
          >
            {b.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-fg-muted">
        {t("Today: {leaks} leaks · {voids} bathroom · {ml} ml.", { leaks: counts.leaks, voids: counts.voids, ml: counts.fluidMl })}{" "}
        <Link href="/bladder" className="text-accent hover:underline">{t("Add details")}</Link>
      </p>
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
