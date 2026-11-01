"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { markUsedUp, setRunningLow } from "@/app/(app)/pantry/actions";

/** From the grocery list: "we're out of X" / "X is running low", picked from the pantry. */
export function RunningOut({ items }: { items: { id: string; name: string; staple: boolean; running_low: boolean }[] }) {
  const t = useT();
  const { toast } = useToast();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((i) => !gone.has(i.id) && (!n || i.name.toLowerCase().includes(n))).slice(0, n ? 12 : 8);
  }, [items, q, gone]);

  const act = (id: string, fn: () => Promise<{ error?: string; message?: string }>, remove: boolean) =>
    start(async () => {
      const r = await fn();
      toast(r.error ?? r.message ?? t("Done"), { tone: r.error ? "error" : "ok" });
      if (!r.error) {
        if (remove) setGone((g) => new Set(g).add(id));
        router.refresh();
      }
    });

  if (!items.length) return null;
  return (
    <Card className="!p-0">
      <details>
        <summary className="cursor-pointer list-none px-4 py-3 text-[15px] font-medium">{t("Running out of something?")}</summary>
        <div className="space-y-2 px-4 pb-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search the pantry, e.g. atta, milk")} aria-label={t("Search the pantry")} />
          <ul className="divide-y divide-border">
            {list.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate text-[14px]">{i.staple ? "★ " : ""}{i.name}{i.running_low ? <span className="text-fg-muted"> · {t("running low")}</span> : null}</span>
                <span className="flex shrink-0 gap-1">
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(i.id, () => markUsedUp(i.id, true), true)}>{t("Out")}</Button>
                  {!i.running_low ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(i.id, () => setRunningLow(i.id), false)}>{t("Low")}</Button> : null}
                </span>
              </li>
            ))}
            {!list.length ? <li className="py-2 text-sm text-fg-muted">{t("Nothing in the pantry matches. Add it to the list above.")}</li> : null}
          </ul>
        </div>
      </details>
    </Card>
  );
}
