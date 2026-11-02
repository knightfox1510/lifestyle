"use client";

import { useTransition } from "react";
import Link from "next/link";
import { cx } from "@/components/ui";
import { setViewMode } from "@/app/(app)/view-actions";
import { useT } from "@/lib/i18n/client";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

function Avatar({ name, active }: { name: string; active: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase",
        active ? "bg-accent-fg/20 text-accent-fg" : "bg-surface text-fg-muted",
      )}
    >
      {firstName(name).slice(0, 1)}
    </span>
  );
}

/** Whose data is on screen: you or your partner (partner view shows only what they shared). */
export function ViewSwitch({
  mode,
  meName,
  partnerName,
}: {
  mode: "me" | "partner";
  meName: string;
  partnerName: string | null;
}) {
  const [pending, start] = useTransition();
  const t = useT();

  if (!partnerName) {
    return (
      <Link href="/settings/household" className="rounded-full border border-border px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2">
        {t("+ Invite partner")}
      </Link>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("Whose data to show")}
      className={cx("flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1 text-sm shadow-sm", pending && "opacity-60")}
    >
      {(
        [
          ["me", meName],
          ["partner", partnerName],
        ] as const
      ).map(([value, name]) => {
        const active = mode === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            title={value === "me" ? t("Your own data") : t("{name}'s shared data", { name })}
            disabled={pending}
            onClick={() => !active && start(() => setViewMode(value))}
            className={cx(
              "flex min-h-9 max-w-36 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 font-semibold transition active:scale-95",
              active ? "bg-accent text-accent-fg shadow" : "text-fg-muted hover:text-fg",
            )}
          >
            <Avatar name={name} active={active} />
            <span className="truncate">{firstName(name)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A clear strip under the header while you're looking at your partner's data. */
export function PartnerViewBanner({ partnerName }: { partnerName: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-accent/30 bg-accent-soft px-4 py-2 text-sm md:px-8 print:hidden">
      <span>
        👀 {t("Viewing {name}'s data", { name: firstName(partnerName) })}
      </span>
      <button disabled={pending} onClick={() => start(() => setViewMode("me"))} className="shrink-0 font-semibold text-accent underline-offset-2 hover:underline">
        {pending ? "…" : t("Back to mine")}
      </button>
    </div>
  );
}
