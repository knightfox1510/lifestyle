"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { toggleSupplement } from "./actions";

/** One-tap "Take" for a supplement on a day, with Undo. */
export function SupplementTakeButton({ supplementId, ownerId, date, name, taken = false }: { supplementId: string; ownerId: string; date: string; name: string; taken?: boolean }) {
  const t = useT();
  const { toast } = useToast();
  const [done, setDone] = useState(taken);
  const [pending, start] = useTransition();
  const set = (value: boolean) =>
    start(async () => {
      setDone(value);
      const r = await toggleSupplement(supplementId, ownerId, date, value);
      if (r.error) {
        setDone(!value);
        toast(r.error, { tone: "error" });
      } else if (value) toast(t("{name} taken", { name }), { undo: () => toggleSupplement(supplementId, ownerId, date, false) });
    });
  return done ? (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => set(false)}>
      ✓ {t("Taken")}
    </Button>
  ) : (
    <Button size="sm" pending={pending} onClick={() => set(true)}>
      {t("Take")}
    </Button>
  );
}
