"use client";

import { useTransition } from "react";
import { Flame } from "lucide-react";
import { sendCheer } from "@/lib/engagement-actions";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";

/** Partner's streak and whether they logged today (dates only), with cheers. */
export function PartnerCard({
  partner,
  cheers,
}: {
  partner: { id: string; name: string; streak: number; loggedToday: boolean };
  cheers: { name: string; emoji: string }[];
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <section className="rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)]">
      {cheers.length ? (
        <p className="mb-3 rounded-2xl bg-accent-soft px-3 py-2 text-[14px] text-accent [animation:pop_.4s_ease-out]">
          {cheers.map((c) => c.emoji).join(" ")} {t("{name} cheered you on", { name: cheers[0].name })}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent">{partner.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{partner.name}</p>
          <p className="flex items-center gap-1 text-[13px] text-fg-muted">
            <Flame className="size-3.5 text-sun" aria-hidden />
            <span className="tabular">{partner.streak}</span> · {partner.loggedToday ? t("logged today") : t("nothing logged yet today")}
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label={t("Send a cheer")}>
          {["👏", "❤️", "💪"].map((e) => (
            <button
              key={e}
              disabled={pending}
              className="pressable grid size-10 place-items-center rounded-full bg-surface-2 text-[18px] disabled:opacity-50"
              aria-label={t("Send {emoji}", { emoji: e })}
              onClick={() =>
                start(async () => {
                  const r = await sendCheer(partner.id, e);
                  toast(r.error ?? r.message ?? e, { tone: r.error ? "error" : "ok" });
                })
              }
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
