"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/** The day's name; tapping it opens a date picker to jump to any earlier day. */
export function DateJump({ date, today, label }: { date: string; today: string; label: string }) {
  const router = useRouter();
  const t = useT();
  return (
    <label className="pressable relative flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold hover:bg-surface-2">
      <CalendarDays className="size-4 text-fg-muted" aria-hidden />
      {label}
      <input
        type="date"
        aria-label={t("Pick a day")}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={date}
        max={today}
        onChange={(e) => e.target.value && router.push(e.target.value === today ? "/food" : `/food?date=${e.target.value}`)}
      />
    </label>
  );
}
