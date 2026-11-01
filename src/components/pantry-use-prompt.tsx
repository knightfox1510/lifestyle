"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { markUsedUp, pantryMatches, setRunningLow } from "@/app/(app)/pantry/actions";

type Match = { id: string; name: string; staple: boolean };

/**
 * After cooking or logging a meal: "Used any of these from the pantry?"
 * Nothing changes until you tap (pantry amounts are rough, so no guessing).
 */
export function PantryUsePrompt({ names, onDone }: { names: string[]; onDone?: () => void }) {
  const t = useT();
  const { toast } = useToast();
  const [items, setItems] = useState<Match[] | null>(null);
  const [pending, start] = useTransition();
  const key = names.join("|");

  useEffect(() => {
    let alive = true;
    pantryMatches(key ? key.split("|") : []).then((m) => alive && setItems(m)).catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [key]);

  if (!items?.length) return null;
  const drop = (id: string) => {
    const rest = items.filter((x) => x.id !== id);
    setItems(rest);
    if (!rest.length) onDone?.();
  };
  const act = (m: Match, fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.error ?? r.message ?? m.name, { tone: r.error ? "error" : "ok" });
      if (!r.error) drop(m.id);
    });

  return (
    <div className="space-y-2 rounded-[18px] bg-surface-2/70 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium">{t("Used any of these from the pantry?")}</p>
        <button className="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface" aria-label={t("Close")} onClick={() => { setItems([]); onDone?.(); }}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ul className="space-y-1.5">
        {items.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[14px]">{m.staple ? "★ " : ""}{m.name}</span>
            <span className="flex gap-1">
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(m, () => markUsedUp(m.id, false))}>{t("Used up")}</Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(m, () => setRunningLow(m.id))}>{t("Running low")}</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => drop(m.id)}>{t("Some left")}</Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
