"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { logDose, undoDose } from "./actions";
import { useT } from "@/lib/i18n/client";

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
  if (doseId) {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => undoDose(doseId, ownerId))}>
        {t("Undo")}
      </Button>
    );
  }
  return (
    <div className="flex gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => start(async () => void (await logDose(medicineId, ownerId, date, time, "taken")))}>
        {t("Take")}
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => void (await logDose(medicineId, ownerId, date, time, "skipped")))}>
        {t("Skip")}
      </Button>
    </div>
  );
}

export function AsNeededButton({ medicineId, ownerId, date }: { medicineId: string; ownerId: string; date: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => void (await logDose(medicineId, ownerId, date, null, "taken")))}>
      {pending ? "…" : t("Took a dose")}
    </Button>
  );
}
