/**
 * "You've had this before" (pure; unit-tested): when every part of a typed
 * meal is something already in your recent foods, it can be logged again
 * straight away, with the numbers used last time, without asking the AI.
 */
export type KnownFood = { id: string; description: string; quantity: string | null; calories: number | null };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}½¼¾\s]/gu, " ").replace(/\s+/g, " ").trim();

/** The typed meal's parts: "2 roti, dal and salad" → ["2 roti", "dal", "salad"]. */
export const mealParts = (text: string) => text.split(/,|\+|&|\n|\band\b|\baur\b|\bwith\b/i).map(norm).filter(Boolean);

export function knownFoods<T extends KnownFood>(text: string, recent: T[]): T[] | null {
  const parts = mealParts(text);
  if (!parts.length || parts.length > 8) return null;
  const found: T[] = [];
  for (const p of parts) {
    const hit = recent.find((r) => {
      const d = norm(r.description);
      return d === p || (r.quantity ? norm(`${r.quantity} ${r.description}`) === p || norm(`${r.description} ${r.quantity}`) === p : false);
    });
    if (!hit) return null;
    found.push(hit);
  }
  return found;
}
