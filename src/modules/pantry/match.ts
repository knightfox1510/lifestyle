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

const words = (s: string) => new Set(s.split(" ").filter(Boolean));

/** True when every word of the shorter name is a whole word of the longer ("paneer" ~ "malai paneer 200g"). */
export function namesMatch(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [words(na), words(nb)] : [words(nb), words(na)];
  return [...short].every((w) => long.has(w));
}

/** Open pantry items that any of these ingredient/food names refer to (no duplicates). */
export function matchPantry<T extends Pick<PantryItem, "id" | "name" | "used_up_at">>(names: string[], pantry: T[]): T[] {
  const skip = new Set(["water", "salt", "ice"]);
  const wanted = names.map((n) => n.trim()).filter((n) => n && !skip.has(normalizeName(n)));
  return pantry.filter((p) => !p.used_up_at && wanted.some((n) => namesMatch(n, p.name)));
}

/** Where a bought item usually goes and roughly how long it keeps (estimate; editable). */
export function restockDefaults(category: string): { location: "fridge" | "freezer" | "pantry"; days: number | null } {
  switch (category) {
    case "dairy": return { location: "fridge", days: 5 };
    case "produce": return { location: "fridge", days: 7 };
    case "meat": return { location: "fridge", days: 2 };
    case "bakery": return { location: "pantry", days: 4 };
    case "frozen": return { location: "freezer", days: 90 };
    case "beverages": case "pantry": case "snacks": return { location: "pantry", days: 180 };
    default: return { location: "pantry", days: null };
  }
}
