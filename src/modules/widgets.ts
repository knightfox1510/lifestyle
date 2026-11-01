import type { WidgetSize } from "@/lib/types";

/** Home-screen widgets. `module` ties a widget to a feature module (hidden when the module is off). */
export type WidgetDef = {
  key: string;
  name: string;
  description: string;
  module: string | null;
  defaultSize: WidgetSize;
};

export const WIDGETS: WidgetDef[] = [
  { key: "core.getting_started", name: "Getting started", description: "A short setup checklist; disappears when done.", module: null, defaultSize: "lg" },
  { key: "core.today", name: "Today", description: "Date, greeting and who's viewing.", module: null, defaultSize: "lg" },
  { key: "medical_records.quick_log", name: "Quick health log", description: "Log a cold, symptom or medicine in two taps.", module: "medical_records", defaultSize: "md" },
  { key: "medical_records.timeline", name: "Recent health timeline", description: "Latest entries and current medicines.", module: "medical_records", defaultSize: "md" },
  { key: "medicines.today", name: "Medicines due", description: "Today's doses with one-tap Take.", module: "medicines", defaultSize: "md" },
  { key: "supplements.today", name: "Supplement checklist", description: "Tick off today's stack.", module: "supplements", defaultSize: "md" },
  { key: "bladder_diary.quick", name: "Bladder quick log", description: "One tap for leak, urge, bathroom or a glass of water.", module: "bladder_diary", defaultSize: "md" },
  { key: "checkin.today", name: "Daily check-in", description: "Sleep, mood, energy and stress.", module: "checkin", defaultSize: "md" },
  { key: "habits.today", name: "Today's habits", description: "Tick off today's habits.", module: "habits", defaultSize: "md" },
  { key: "pelvic_floor.today", name: "Pelvic floor", description: "Today's sessions and streak.", module: "pelvic_floor", defaultSize: "sm" },
  { key: "groceries.list", name: "Grocery list", description: "What's left to buy, with quick add.", module: "groceries", defaultSize: "md" },
  { key: "core.quick_log", name: "Quick log (type or speak)", description: "One sentence logs food, drinks, bladder events and weight.", module: null, defaultSize: "md" },
  { key: "core.water", name: "Water", description: "Today's water against your target, with +250 / +500 ml buttons.", module: null, defaultSize: "sm" },
  { key: "food_diary.today", name: "Calories today", description: "Calories and macros against your goals.", module: "food_diary", defaultSize: "md" },
  { key: "body_recomp.weight", name: "Weight", description: "Latest weight, progress to target and a quick weigh-in.", module: "body_recomp", defaultSize: "sm" },
  { key: "pantry.expiring", name: "Expiring soon", description: "Pantry items to use up in the next 3 days.", module: "pantry", defaultSize: "md" },
  { key: "recipes.today", name: "Today's meal plan", description: "What's planned to cook today.", module: "recipes", defaultSize: "md" },
  { key: "medical_records.labs", name: "Blood work flags", description: "Latest lab values outside the reference range.", module: "medical_records", defaultSize: "md" },
  { key: "fitness.today", name: "Today's workout", description: "Scheduled classes with Done / Skipped.", module: "fitness", defaultSize: "md" },
  { key: "child.today", name: "Child today", description: "Feeds, sleep, nappies and the last medicine dose.", module: "child", defaultSize: "md" },
  { key: "core.coming_up", name: "Coming up", description: "Maintenance, document expiries and subscription renewals.", module: null, defaultSize: "md" },
  { key: "wearables.today", name: "Steps & sleep", description: "Latest steps, sleep and resting heart rate from your band.", module: "wearables", defaultSize: "sm" },
  { key: "watchlist.watching", name: "Watching now", description: "Your episode vs your partner's.", module: "watchlist", defaultSize: "md" },
  { key: "dining.order", name: "Order in tonight?", description: "One tap to AI takeout suggestions.", module: "dining", defaultSize: "sm" },
  { key: "travel.next", name: "Next trip", description: "Countdown and packing progress.", module: "travel", defaultSize: "md" },
  { key: "occasions.upcoming", name: "Upcoming occasions", description: "Birthdays and anniversaries in the next 30 days.", module: "occasions", defaultSize: "md" },
  { key: "core.ask_ai", name: "Ask AI", description: "Ask for a suggestion from Home.", module: null, defaultSize: "md" },
  { key: "core.household", name: "Household", description: "Members and what's shared.", module: null, defaultSize: "md" },
];

export const WIDGET_BY_KEY = Object.fromEntries(WIDGETS.map((w) => [w.key, w])) as Record<string, WidgetDef>;
export const DEFAULT_WIDGETS = [
  "core.getting_started",
  "food_diary.today",
  "fitness.today",
  "bladder_diary.quick",
  "supplements.today",
  "checkin.today",
  "habits.today",
  "pelvic_floor.today",
  "body_recomp.weight",
  "groceries.list",
  "pantry.expiring",
  "recipes.today",
  "child.today",
  "core.coming_up",
  "occasions.upcoming",
  "travel.next",
  "watchlist.watching",
  "wearables.today",
  "dining.order",
  "medical_records.labs",
  "medical_records.quick_log",
  "core.ask_ai",
];
