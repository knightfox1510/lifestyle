/**
 * How much "brain" each AI feature gets (pure; unit-tested). Most features
 * read a label, break a meal into ingredients or fill a form: they don't need
 * the expensive Pro model or long hidden "thinking", which Google bills as
 * output tokens. Only the few that reason over your health get them.
 */
export type Thinking = "minimal" | "low" | "high";
export type FeatureProfile = {
  label: string;
  /** Reasoning over health data: may use Pro (when the household picks "Best") and full thinking. */
  deep?: boolean;
  thinking: Thinking;
  /** Photo detail: "medium" (~256 tokens) is plenty to recognise food; labels and documents keep full detail. */
  media?: "medium" | "high";
};

export const FEATURES: Record<string, FeatureProfile> = {
  food_estimate: { label: "Food: describe or photo a meal", thinking: "low", media: "medium" },
  quick_log: { label: "Quick log (type anything)", thinking: "minimal" },
  food_label: { label: "Food: nutrition label photo", thinking: "minimal" },
  supplement_label: { label: "Supplement label photo", thinking: "minimal" },
  medicine_info: { label: "Medicine lookup / strip photo", thinking: "minimal" },
  recipe_calc: { label: "Recipe nutrition", thinking: "minimal" },
  scan_receipt: { label: "Pantry: receipt scan", thinking: "minimal" },
  scan_shelf: { label: "Pantry: shelf photo", thinking: "minimal", media: "medium" },
  scan_list: { label: "Pantry: list photo", thinking: "minimal" },
  menu_import: { label: "Dining: menu screenshots", thinking: "minimal" },
  dining_import: { label: "Dining: bulk import", thinking: "minimal" },
  menu_online: { label: "Dining: find menu online (web search)", thinking: "minimal" },
  watch_info: { label: "Watchlist: look up titles (web search)", thinking: "minimal" },
  watch_seasons: { label: "Watchlist: new seasons (web search)", thinking: "minimal" },
  watch_suggest: { label: "Watchlist: suggestions (web search)", thinking: "low" },
  meal_ideas: { label: "Meal ideas", thinking: "low" },
  what_to_order: { label: "What to order", thinking: "low" },
  plan_recipe: { label: "Recipe from the plan", thinking: "low" },
  week_plan: { label: "Week meal plan", thinking: "low" },
  trip_plan: { label: "Trip packing plan", thinking: "low" },
  nutrition_goals: { label: "Nutrition goals", thinking: "low" },
  weekly_digest: { label: "Weekly AI summary (automatic, Sundays)", thinking: "low" },
  nutrition_report: { label: "Nutrition report", thinking: "high", deep: true },
  coach: { label: "AI coach", thinking: "high", deep: true },
  visit_summary: { label: "Doctor visit summary", thinking: "high", deep: true },
  medicine_check: { label: "Medicine safety check", thinking: "high", deep: true },
  medical_extract: { label: "Medical document reading", thinking: "low", deep: true },
  assistant: { label: "Ask AI", thinking: "high", deep: true },
  ai_test: { label: "Test AI button", thinking: "minimal" },
};

export const profileFor = (feature: string): FeatureProfile => FEATURES[feature] ?? { label: feature.replace(/_/g, " "), thinking: "low" };

/**
 * Approximate list prices, US$ per million tokens (Google AI paid tier, prompts
 * under 200k tokens). Thinking is billed as output; cached input at 10%.
 * Check ai.google.dev/pricing: these are estimates for comparing features.
 */
export const PRICES = {
  flash: { input: 0.5, output: 3 },
  pro: { input: 2, output: 12 },
  lite: { input: 0.25, output: 1.5 },
} as const;
/** Google Search grounding, per search query (after the monthly free allowance). */
export const SEARCH_QUERY_USD = 14 / 1000;

export const priceFamily = (model: string | null | undefined): keyof typeof PRICES => (/lite/.test(model ?? "") ? "lite" : /pro/.test(model ?? "") ? "pro" : "flash");

export type UsageRow = {
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  thinking_tokens?: number | null;
  cached_tokens?: number | null;
  search_queries?: number | null;
};

/** Estimated cost of one AI request in US$. */
export function estimateUsd(r: UsageRow) {
  const p = PRICES[priceFamily(r.model)];
  const cached = Math.min(r.cached_tokens ?? 0, r.input_tokens ?? 0);
  const input = ((r.input_tokens ?? 0) - cached + cached * 0.1) * p.input;
  const output = ((r.output_tokens ?? 0) + (r.thinking_tokens ?? 0)) * p.output;
  return (input + output) / 1e6 + (r.search_queries ?? 0) * SEARCH_QUERY_USD;
}
