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
  { key: "core.ask_ai", name: "Ask AI", description: "Ask for a suggestion from Home.", module: null, defaultSize: "md" },
  { key: "core.household", name: "Household", description: "Members and what's shared.", module: null, defaultSize: "md" },
];

export const WIDGET_BY_KEY = Object.fromEntries(WIDGETS.map((w) => [w.key, w])) as Record<string, WidgetDef>;
export const DEFAULT_WIDGETS = [
  "core.today",
  "medicines.today",
  "bladder_diary.quick",
  "supplements.today",
  "checkin.today",
  "habits.today",
  "pelvic_floor.today",
  "groceries.list",
  "medical_records.quick_log",
  "core.ask_ai",
];
