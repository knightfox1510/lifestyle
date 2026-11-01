/** Foods and drinks commonly reported to irritate the bladder. */
export const IRRITANTS = ["caffeine", "alcohol", "spicy", "citrus", "tomato", "carbonated", "sweetener", "chocolate"] as const;
export type Irritant = (typeof IRRITANTS)[number];

export const IRRITANT_META: Record<Irritant, { label: string; icon: string }> = {
  caffeine: { label: "Caffeine", icon: "☕" },
  alcohol: { label: "Alcohol", icon: "🍷" },
  spicy: { label: "Spicy", icon: "🌶️" },
  citrus: { label: "Citrus", icon: "🍋" },
  tomato: { label: "Tomato", icon: "🍅" },
  carbonated: { label: "Fizzy", icon: "🫧" },
  sweetener: { label: "Artificial sweetener", icon: "🧪" },
  chocolate: { label: "Chocolate", icon: "🍫" },
};

export function cleanIrritants(list: unknown): Irritant[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((x): x is Irritant => (IRRITANTS as readonly string[]).includes(x as string)))];
}
