"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PenLine, Search, Sparkles } from "lucide-react";
import { cx } from "@/components/ui";
import type { PersonPortion } from "@/components/nutrition-ui";
import type { Meal } from "@/lib/types";
import type { LogDay } from "@/modules/food/meta";
import { FoodAiAdd } from "./food-ai-add";
import { ManualFoodForm } from "./manual-food-form";
import { FoodQuickSearch, type RecentFood } from "./quick-search";

type Tab = "search" | "ai" | "manual";
const TAB_KEY = "hearth.food.addTab";
const TABS: { key: Tab; label: string; hint: string; Icon: typeof Search }[] = [
  { key: "search", label: "Search", hint: "Foods you've had, your foods, dishes", Icon: Search },
  { key: "ai", label: "Describe or photo", hint: "“2 rotis, dal and a katori of rice”", Icon: Sparkles },
  { key: "manual", label: "Type it in", hint: "You know the calories", Icon: PenLine },
];

/**
 * One place to add food, the same at the top of the diary and inside each
 * meal: search, describe/photograph (AI works it out), or type the numbers.
 * The last tab used is remembered on this device. `extra` holds shortcuts
 * (packaged food, Indian dishes, restaurants).
 */
export function FoodAddPanel({ ownerId, people, day, meal, recent, compact = false, extra }: { ownerId: string; people: PersonPortion[]; day: LogDay; meal?: Meal; recent: RecentFood[]; compact?: boolean; extra?: ReactNode }) {
  const [tab, setTab] = useState<Tab>("search");
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(TAB_KEY) as Tab | null;
        if (saved && TABS.some((x) => x.key === saved)) setTab(saved);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  };
  const active = TABS.find((x) => x.key === tab)!;

  return (
    <div className="space-y-2.5">
      <div role="tablist" aria-label="How to add food" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => choose(x.key)}
            className={cx("pressable flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-medium", tab === x.key ? "bg-surface text-fg shadow-[0_0_0_1px_var(--border)]" : "text-fg-muted hover:text-fg")}
          >
            <x.Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{x.label}</span>
          </button>
        ))}
      </div>
      {!compact ? <p className="px-1 text-xs text-fg-muted">{active.hint}</p> : null}
      <div role="tabpanel" className="[animation:fade-in_.15s_ease-out]">
        {tab === "search" ? <FoodQuickSearch ownerId={ownerId} people={people} day={day} meal={meal} recent={recent} compact={compact} /> : null}
        {tab === "ai" ? <FoodAiAdd key={`${day.date}-${meal ?? ""}`} ownerId={ownerId} people={people} day={day} meal={meal} recent={recent} /> : null}
        {tab === "manual" ? <ManualFoodForm key={`m-${day.date}-${meal ?? ""}`} ownerId={ownerId} day={day} meal={meal} defaultOpen /> : null}
      </div>
      {extra ? <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1">{extra}</div> : null}
    </div>
  );
}
