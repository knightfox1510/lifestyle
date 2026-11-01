"use client";

import { useTransition } from "react";
import Link from "next/link";
import { cx } from "@/components/ui";
import { setViewMode } from "@/app/(app)/view-actions";
import { useT } from "@/lib/i18n/client";

/** Personal vs Partner toggle. Partner view shows only what the partner shared. */
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
      className={cx("grid grid-cols-2 rounded-full bg-surface-2 p-0.5 text-xs", pending && "opacity-60")}
    >
      {(
        [
          ["me", t("Personal"), meName],
          ["partner", partnerName, partnerName],
        ] as const
      ).map(([value, label, title]) => (
        <button
          key={value}
          role="radio"
          aria-checked={mode === value}
          title={title}
          disabled={pending}
          onClick={() => start(() => setViewMode(value))}
          className={cx(
            "max-w-32 truncate rounded-full px-3 py-1.5 font-medium transition",
            mode === value ? "bg-surface shadow-sm" : "text-fg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
