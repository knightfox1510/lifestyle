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
  { key: "core.ask_ai", name: "Ask AI", description: "Ask for a suggestion from Home.", module: null, defaultSize: "md" },
  { key: "core.household", name: "Household", description: "Members and what's shared.", module: null, defaultSize: "md" },
];

export const WIDGET_BY_KEY = Object.fromEntries(WIDGETS.map((w) => [w.key, w])) as Record<string, WidgetDef>;
export const DEFAULT_WIDGETS = WIDGETS.map((w) => w.key);
