"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import type { PersonPortion } from "@/components/nutrition-ui";
import type { Meal } from "@/lib/types";
import type { LogDay } from "@/modules/food/meta";
import { useT } from "@/lib/i18n/client";
import { FoodAiAdd } from "./food-ai-add";
import { ManualFoodForm } from "./manual-food-form";

/** "＋ Add" on a meal card: opens the logger right inside that card, set to that meal. */
export function MealAdd({ ownerId, people, day, meal, children }: { ownerId: string; people: PersonPortion[]; day: LogDay; meal: Meal; children: React.ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
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
          <FoodAiAdd ownerId={ownerId} people={people} day={day} meal={meal} />
          <ManualFoodForm ownerId={ownerId} day={day} meal={meal} />
        </div>
      ) : null}
    </>
  );
}
