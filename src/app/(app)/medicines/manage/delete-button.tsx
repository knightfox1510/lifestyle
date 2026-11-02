"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { deleteMedicine } from "../actions";

/** Delete with a confirm step: removes the medicine and its dose history (for ones added by mistake). */
export function DeleteMedicineButton({ id, ownerId, name }: { id: string; ownerId: string; name: string }) {
  const t = useT();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} className="text-danger">
        <Trash2 className="size-3.5" aria-hidden /> {t("Delete")}
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-lg bg-danger/10 px-2 py-1 text-xs">
      {t("Delete {name} and its dose history?", { name })}
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteMedicine(id, ownerId);
            if (r.error) toast(r.error, { tone: "error" });
            else toast(t("Medicine deleted."));
            setConfirm(false);
          })
        }
      >
        {pending ? "…" : t("Yes, delete")}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>
        {t("Cancel")}
      </Button>
    </span>
  );
}
