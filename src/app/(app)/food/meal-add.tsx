"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import type { PersonPortion } from "@/components/nutrition-ui";
import type { Meal } from "@/lib/types";
import type { LogDay } from "@/modules/food/meta";
import { useT } from "@/lib/i18n/client";
import { FoodAiAdd } from "./food-ai-add";
import { ManualFoodForm } from "./manual-food-form";
import { FoodQuickSearch, type RecentFood } from "./quick-search";
import { copyMeal } from "./actions";
import { useToast } from "@/components/toaster";

/** "＋ Add" on a meal card: opens the logger right inside that card, set to that meal. */
export function MealAdd({
  ownerId,
  people,
  day,
  meal,
  recent,
  previous,
  children,
}: {
  ownerId: string;
  people: PersonPortion[];
  day: LogDay;
  meal: Meal;
  recent: RecentFood[];
  /** The same meal on the day before, if anything was logged: one tap copies it. */
  previous: { date: string; label: string; items: string[] } | null;
  children: React.ReactNode;
}) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <div className="mb-1 flex items-baseline justify-between">
        {children}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={buttonClass("soft", "sm")}>
          {open ? t("Close") : `＋ ${t("Add")}`}
        </button>
      </div>
      {open ? (
        <div className="mb-3 space-y-2">
          {previous ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { const r = await copyMeal(ownerId, previous.date, meal, day.date); toast(r.error ?? r.message ?? "Added.", r.error ? { tone: "error" } : undefined); if (!r.error) setOpen(false); })}
              className="w-full rounded-xl border border-dashed border-accent/50 px-3 py-2 text-left text-sm hover:bg-accent-soft"
            >
              ↻ {t("Same as {day}", { day: previous.label })}: <span className="text-fg-muted">{previous.items.join(", ")}</span>
            </button>
          ) : null}
          <FoodQuickSearch ownerId={ownerId} people={people} day={day} meal={meal} recent={recent} compact />
          <FoodAiAdd ownerId={ownerId} people={people} day={day} meal={meal} />
          <ManualFoodForm ownerId={ownerId} day={day} meal={meal} />
        </div>
      ) : null}
    </>
  );
}
