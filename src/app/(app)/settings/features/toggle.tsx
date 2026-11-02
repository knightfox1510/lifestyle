"use client";

import { useState, useTransition } from "react";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { setModuleHiddenForMe } from "../actions";

export function MyFeatureToggle({ moduleKey, on, label }: { moduleKey: string; on: boolean; label: string }) {
  const { toast } = useToast();
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={pending}
      onClick={() => {
        const next = !value;
        setValue(next);
        start(async () => {
          const r = await setModuleHiddenForMe(moduleKey, !next);
          if (r.error) {
            setValue(!next);
            toast(r.error, { tone: "error" });
          }
        });
      }}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition", value ? "bg-accent" : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--border)]")}
    >
      <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", value ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}
