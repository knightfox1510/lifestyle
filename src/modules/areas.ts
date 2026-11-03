/**
 * Related features shown together: a shortcut row at the top of each screen in
 * an area, so moving between them (plan → groceries → pantry; medicines ↔
 * supplements; bladder ↔ pelvic floor ↔ cycle) is one tap.
 */
export type AreaKey = "food" | "meds" | "pelvic" | "body";
export type AreaItem = { href: string; label: string; module: string };

export const AREAS: Record<AreaKey, AreaItem[]> = {
  food: [
    { href: "/food", label: "Diary", module: "food_diary" },
    { href: "/food/plan", label: "Week plan", module: "food_diary" },
    { href: "/groceries", label: "Groceries", module: "groceries" },
    { href: "/pantry", label: "Pantry", module: "pantry" },
    { href: "/recipes", label: "Recipes", module: "recipes" },
    { href: "/dining", label: "Eating out", module: "dining" },
  ],
  meds: [
    { href: "/medicines", label: "Medicines", module: "medicines" },
    { href: "/supplements", label: "Supplements", module: "supplements" },
    { href: "/medicines/checks", label: "Safety checks", module: "medicines" },
  ],
  pelvic: [
    { href: "/bladder", label: "Bladder diary", module: "bladder_diary" },
    { href: "/pelvic-floor", label: "Pelvic floor", module: "pelvic_floor" },
    { href: "/cycle", label: "Cycle", module: "cycle" },
  ],
  body: [
    { href: "/body", label: "Body", module: "body_recomp" },
    { href: "/body/coach", label: "AI coach", module: "body_recomp" },
    { href: "/food/goals", label: "Nutrition goals", module: "food_diary" },
    { href: "/fitness", label: "Fitness", module: "fitness" },
    { href: "/wearables", label: "Wearables", module: "wearables" },
  ],
};

/** The area item a path belongs to: the longest matching href wins (/food/plan beats /food). */
export function activeAreaHref(path: string, items: { href: string }[]) {
  return items
    .filter((i) => path === i.href || path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

/** Path prefixes for the phone tab bar, so "Health" / "Food" stay highlighted inside their features. */
export const TAB_MATCH = {
  health: ["/health", "/medical", "/medicines", "/supplements", "/bladder", "/pelvic-floor", "/cycle", "/checkin", "/habits", "/body", "/fitness", "/wearables"],
  food: ["/food", "/groceries", "/pantry", "/recipes", "/dining"],
  family: ["/me", "/child", "/maintenance", "/occasions", "/watchlist", "/travel", "/documents", "/subscriptions", "/settings", "/digest", "/customize", "/notifications"],
} as const;
