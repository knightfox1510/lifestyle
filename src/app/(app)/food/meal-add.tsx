"use client";

import { useState } from "react";
import { buttonClass, cx } from "@/components/ui";
import type { PersonPortion } from "@/components/nutrition-ui";
import type { Meal } from "@/lib/types";
import type { LogDay } from "@/modules/food/meta";
import { useT } from "@/lib/i18n/client";
import { FoodAddPanel } from "./food-add-panel";
import type { RecentFood } from "./quick-search";
import { CopyPicker, type CopySource } from "./copy-picker";

/**
 * "＋ Add" on a meal card: opens right inside that card, set to that meal.
 * Quickest first: copy what your partner had (with your portion) or the
 * same meal yesterday, then search / describe / type it in.
 */
export function MealAdd({
  ownerId,
  people,
  day,
  meal,
  recent,
  copies,
  emptyLabel,
  children,
}: {
  ownerId: string;
  people: PersonPortion[];
  day: LogDay;
  meal: Meal;
  recent: RecentFood[];
  /** Partner's same meal that day, and this meal yesterday: tick items, pick a portion, add. */
  copies: CopySource[];
  /** Shown as a big "＋ Log breakfast" button while the meal is empty. */
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-1 flex items-baseline justify-between">
        {children}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cx(buttonClass(open ? "ghost" : "soft", "sm"), "relative")}>
          {open ? t("Close") : `＋ ${t("Add")}`}
          {!open && copies.some((c) => c.who) ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent" aria-hidden /> : null}
        </button>
      </div>
      {!open && emptyLabel ? (
        <button type="button" onClick={() => setOpen(true)} className="pressable mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm text-fg-muted hover:border-accent hover:text-accent">
          ＋ {emptyLabel}
          {copies.some((c) => c.who) ? <span className="text-xs">· {t("or copy")} {copies.find((c) => c.who)!.who}</span> : null}
        </button>
      ) : null}
      {open ? (
        <div className="mb-3 space-y-2.5 [animation:toast-in_.2s_ease-out]">
          {copies.length ? (
            <div className="space-y-1.5">
              {copies.map((c) => (
                <CopyPicker key={c.key} source={c} ownerId={ownerId} people={people} meal={meal} date={day.date} onDone={() => setOpen(false)} />
              ))}
            </div>
          ) : null}
          <FoodAddPanel ownerId={ownerId} people={people} day={day} meal={meal} recent={recent} compact />
        </div>
      ) : null}
    </>
  );
}
