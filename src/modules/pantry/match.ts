import type { PantryItem } from "@/lib/types";

/** Loose name normalisation so "2 Tomatoes" matches "tomato". */
export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[\d.,/]+\s*(kg|g|gm|grams?|ml|l|litres?|liters?|pcs?|pieces?|packs?|cups?|tbsp|tsp|dozen)?\b/g, " ")
    .replace(/\b(fresh|organic|large|small|medium|chopped|sliced|boiled|of|a|an|the)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join(" ")
    .trim();
}

export function inPantry(ingredient: string, pantry: Pick<PantryItem, "name" | "used_up_at">[]) {
  const n = normalizeName(ingredient);
  if (!n) return false;
  return pantry.some((p) => {
    if (p.used_up_at) return false;
    const pn = normalizeName(p.name);
    return pn === n || pn.includes(n) || n.includes(pn);
  });
}

export function daysUntil(date: string | null, today: string) {
  if (!date) return null;
  return Math.round((new Date(`${date}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400_000);
}
