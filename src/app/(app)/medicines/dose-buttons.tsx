"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { logDose, undoDose } from "./actions";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/toaster";

export function DoseButtons({
  medicineId,
  ownerId,
  date,
  time,
  doseId,
}: {
  medicineId: string;
  ownerId: string;
  date: string;
  time: string;
  doseId: string | null;
}) {
  const [pending, start] = useTransition();
  const t = useT();
  const { toast } = useToast();
  const log = (status: "taken" | "skipped") =>
    start(async () => {
      const r = await logDose(medicineId, ownerId, date, time, status);
      if (r.error) toast(r.error, { tone: "error" });
      else toast(status === "taken" ? t("Dose taken") : t("Dose skipped"), { undo: r.id ? () => undoDose(r.id!, ownerId) : undefined });
    });
  if (doseId) {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => undoDose(doseId, ownerId))}>
        {t("Undo")}
      </Button>
    );
  }
  return (
    <div className="flex gap-1.5">
      <Button size="sm" pending={pending} onClick={() => log("taken")}>
        {t("Take")}
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => log("skipped")}>
        {t("Skip")}
      </Button>
    </div>
  );
}

export function AsNeededButton({ medicineId, ownerId, date }: { medicineId: string; ownerId: string; date: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  const { toast } = useToast();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await logDose(medicineId, ownerId, date, null, "taken"); if (r.error) toast(r.error, { tone: "error" }); else toast(t("Dose taken"), { undo: r.id ? () => undoDose(r.id!, ownerId) : undefined }); })}>
      {pending ? "…" : t("Took a dose")}
    </Button>
  );
}
