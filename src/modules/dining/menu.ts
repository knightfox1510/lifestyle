import { normalizeName } from "@/modules/pantry/match";
import type { DiningDish } from "@/lib/types";

export type Portion = { key: string; label: string; factor: number };

/** Portion choices when logging a restaurant dish. */
export function portionOptions(maxShare = 4): Portion[] {
  return [
    { key: "full", label: "Whole portion", factor: 1 },
    { key: "half", label: "Half", factor: 0.5 },
    ...Array.from({ length: maxShare - 1 }, (_, i) => ({ key: `share${i + 2}`, label: `Shared by ${i + 2}`, factor: 1 / (i + 2) })),
    { key: "double", label: "Two portions", factor: 2 },
  ];
}

/** Scales a dish's per-person nutrition for a food-diary entry. */
export function scaleDish(d: Pick<DiningDish, "name" | "calories" | "protein_g" | "carbs_g" | "fat_g">, factor: number, placeName?: string) {
  const s = (v: number | null) => Math.round(Number(v ?? 0) * factor * 10) / 10;
  return {
    description: `${d.name}${placeName ? ` (${placeName})` : ""}`.slice(0, 200),
    quantity: factor === 1 ? null : factor === 0.5 ? "half" : factor === 2 ? "2 portions" : `1/${Math.round(1 / factor)} share`,
    calories: Math.round(Number(d.calories ?? 0) * factor),
    protein_g: s(d.protein_g),
    carbs_g: s(d.carbs_g),
    fat_g: s(d.fat_g),
    fiber_g: 0,
  };
}

/** Finds the saved dish an AI suggestion refers to (exact, then loose name match). */
export function matchDish<T extends Pick<DiningDish, "name">>(name: string, dishes: T[]): T | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  return (
    dishes.find((d) => normalizeName(d.name) === n) ??
    dishes.find((d) => {
      const dn = normalizeName(d.name);
      return dn.length >= 4 && (n.includes(dn) || dn.includes(n));
    })
  );
}
