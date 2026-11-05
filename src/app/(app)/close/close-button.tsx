"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, cx } from "@/components/ui";
import { Confetti } from "@/components/today/celebrate";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { closeDay } from "./actions";

export type LeftItem = { key: string; label: string; icon: string };

/**
 * The end of the review: tick what you're skipping on purpose (it stops
 * counting as missed), add a one-line note for the day, and close it.
 * Closing stops tonight's reminders and turns Today to tomorrow.
 */
export function CloseDayButton({ date, left, streak, note: note0, skipped: skipped0 }: { date: string; left: LeftItem[]; streak: number; note: string | null; skipped: string[] }) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [skipped, setSkipped] = useState<string[]>(skipped0);
  const [note, setNote] = useState(note0 ?? "");
  const [done, setDone] = useState<null | "all" | "some">(null);
  const [pending, start] = useTransition();
  const stillMissed = left.filter((i) => !skipped.includes(i.key));

  if (done) {
    return (
      <div className="space-y-1 rounded-[24px] bg-fg p-6 text-center text-bg [animation:pop_.45s_ease-out]">
        <Confetti seed="close" />
        <p className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular">🔥 {streak}</p>
        <p className="text-[17px] font-medium">{done === "all" ? t("Day closed. Nicely done.") : t("Day closed. Tomorrow is a fresh start.")}</p>
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-[22px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)]">
      {left.length ? (
        <div>
          <p className="text-[15px] font-medium">{t("Not doing any of these today?")}</p>
          <p className="mb-2 text-[13px] text-fg-muted">{t("Tick what you're skipping on purpose (a fast, a rest day). It won't count as missed.")}</p>
          <ul className="space-y-1.5">
            {left.map((i) => {
              const on = skipped.includes(i.key);
              return (
                <li key={i.key}>
                  <label className={cx("flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors", on ? "border-accent/50 bg-accent-soft" : "border-border")}>
                    <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={on} onChange={(e) => setSkipped(e.target.checked ? [...skipped, i.key] : skipped.filter((k) => k !== i.key))} />
                    <span aria-hidden>{i.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{i.label}</span>
                    <span className={cx("text-xs", on ? "font-medium text-fg" : "text-fg-muted")}>{on ? t("Skipped on purpose") : t("Not done")}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-[13px] text-fg-muted">{t("A note for today (optional)")}</span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder={t("e.g. travelled, felt unwell, family dinner")} />
      </label>
      <Button
        variant="accent"
        className="!h-14 w-full text-[16px]"
        pending={pending}
        onClick={() =>
          start(async () => {
            const r = await closeDay({ date, skipped, note });
            if (r.error) return toast(r.error, { tone: "error" });
            setDone(stillMissed.length ? "some" : "all");
            setTimeout(() => router.push("/"), 2200);
          })
        }
      >
        {stillMissed.length ? t("Close my day ({n} not done)", { n: stillMissed.length }) : t("Close my day")}
      </Button>
      <p className="text-center text-[12px] text-fg-muted">{t("Closing stops tonight's reminders. You can reopen it from Today.")}</p>
    </section>
  );
}
