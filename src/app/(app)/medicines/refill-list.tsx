"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { PillIcon } from "@/components/pill-icon";

export type RefillItem = { id: string; name: string; strength: string | null; unit: string; stock: number; daysLeft: number | null; orderBy: string | null; monthSupply: number | null; pillShape?: string | null; pillColor?: string | null };

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** What to reorder soon, by when, and a list to send the pharmacy. */
export function RefillList({ items, person }: { items: RefillItem[]; person: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const text = [`Medicines for ${person}:`, ...items.map((i) => `• ${i.name}${i.strength ? ` ${i.strength}` : ""}${i.monthSupply ? ` – ${i.monthSupply} ${i.unit}${i.monthSupply === 1 ? "" : "s"} (1 month)` : ""}`)].join("\n");
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      return; // cancelled
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast("Pharmacy list copied", { kind: "save", stamp: false });
  };
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">💊 Refill list</h2>
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => void share()}><Share2 className="size-4" aria-hidden /> Share</Button>
          <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); }} aria-label="Copy pharmacy list"><Copy className="size-4" aria-hidden />{copied ? " ✓" : ""}</Button>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2.5">
            <PillIcon shape={i.pillShape} color={i.pillColor} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{i.name} <span className="font-normal text-fg-muted">{i.strength}</span></p>
              <p className="text-[13px] text-fg-muted">
                {i.stock} left{i.daysLeft !== null ? ` · ~${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"}` : ""}
                {i.monthSupply ? ` · a month is ${i.monthSupply} ${i.unit}${i.monthSupply === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            {i.orderBy ? (
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${i.daysLeft !== null && i.daysLeft <= 5 ? "bg-danger-soft text-danger" : "bg-surface-2"}`}>
                Order by {day(i.orderBy)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-muted">Stock goes down as doses are marked taken. Restock a medicine (in Manage) when the new strip arrives.</p>
    </Card>
  );
}
