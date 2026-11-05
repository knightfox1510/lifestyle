"use client";

import { useTransition } from "react";
import { Flame } from "lucide-react";
import { sendCheer } from "@/lib/engagement-actions";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { RING_META } from "@/components/today/day-views";

/** Partner's streak and whether they logged today (dates only), with cheers. */
type MiniRing = { key: "water" | "food" | "meds" | "check"; pct: number };

/** Small rings in a row: one per daily goal. */
function Rings({ rings, label }: { rings: MiniRing[]; label: string }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`${label}: ${rings.map((r) => `${r.key} ${Math.round(r.pct * 100)}%`).join(", ")}`}>
      {rings.map((r) => {
        const c = 2 * Math.PI * 8;
        return (
          <svg key={r.key} width="22" height="22" viewBox="0 0 22 22" className="-rotate-90" aria-hidden>
            <circle cx="11" cy="11" r="8" fill="none" stroke="var(--arc-track)" strokeWidth="3.5" />
            <circle cx="11" cy="11" r="8" fill="none" stroke={RING_META[r.key].color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, r.pct))} style={{ transition: "stroke-dashoffset .6s" }} />
          </svg>
        );
      })}
    </div>
  );
}

export function PartnerCard({
  partner,
  cheers,
  us,
}: {
  partner: { id: string; name: string; streak: number; loggedToday: boolean };
  cheers: { name: string; emoji: string }[];
  /** Both of your days side by side, the joint weekly goal and a hint (when your partner shares their day). */
  us?: { me: MiniRing[]; them: MiniRing[]; meName: string; joint: { both: number; goal: number; daysSoFar: number; reached: boolean }; hint: string | null } | null;
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
      {us ? (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[12px] text-fg-muted">{us.meName}</p>
              {us.me.length ? <Rings rings={us.me} label={us.meName} /> : <p className="text-[12px] text-fg-muted">–</p>}
            </div>
            <div>
              <p className="mb-1 text-[12px] text-fg-muted">{partner.name}</p>
              {us.them.length ? <Rings rings={us.them} label={partner.name} /> : <p className="text-[12px] text-fg-muted">{t("Not shared")}</p>}
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[12px]">
              <span className="text-fg-muted">{t("Both closed the day this week")}</span>
              <span className="font-medium tabular-nums">{us.joint.both} / {us.joint.goal}{us.joint.reached ? " 🎉" : ""}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full origin-left rounded-full bg-accent [animation:grow-x_.7s_cubic-bezier(.3,.8,.3,1)_both]" style={{ width: `${Math.min(100, (us.joint.both / us.joint.goal) * 100)}%` }} />
            </div>
          </div>
          {us.hint ? <p className="rounded-xl bg-surface-2/70 px-3 py-2 text-[13px]">💬 {us.hint}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
