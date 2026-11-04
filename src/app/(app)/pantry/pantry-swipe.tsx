"use client";

import type { ReactNode } from "react";
import { PackageCheck } from "lucide-react";
import { SwipeRow } from "@/components/swipe-row";
import { useToast } from "@/components/toaster";
import { deletePantryItem, markUsedUp } from "./actions";

/** A pantry row you can swipe: right = used up (staples go back on the list), left = delete. */
export function PantrySwipe({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const { toast } = useToast();
  return (
    <SwipeRow
      className="rounded-xl"
      right={{ label: "Used up", icon: <PackageCheck className="size-4" aria-hidden />, onAction: () => void markUsedUp(id, false).then((r) => toast(r.error ?? r.message ?? "Used up.", r.error ? { tone: "error" } : { kind: "pantry" })) }}
      left={{ label: "Delete", onAction: () => void deletePantryItem(id).then(() => toast(`${name} deleted.`, { kind: "delete" })) }}
    >
      {children}
    </SwipeRow>
  );
}
