/**
 * Bulk import of restaurants, dishes and past orders (pure; unit-tested):
 * match to saved places by name, add only dishes that aren't on the menu yet,
 * and skip orders that were already imported.
 */
import type { DiningImport } from "@/lib/ai/phase2-schemas";

export const PLATFORM_LABEL: Record<string, string> = { swiggy: "Swiggy", zomato: "Zomato", eatsure: "EatSure", magicpin: "magicpin", direct: "Direct", dine_in: "", other: "" };

/** "The Bombay Canteen", "Bombay Canteen" and "bombay canteen restaurant" are the same place. */
export function placeKey(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["the", "restaurant", "restro", "and", "co", "pvt", "ltd", "kitchen"].includes(w))
    .join(" ");
}

export const dishKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function orderText(items: { name: string; quantity: number }[]) {
  return items.map((i) => `${i.quantity}× ${i.name.trim()}`).join(", ").slice(0, 500);
}

type Place = DiningImport["places"][number];
export type ExistingPlace = { id: string; name: string };

export type ImportPlan = {
  places: {
    key: string;
    existingId: string | null;
    insert: { name: string; cuisine: string | null; area: string | null; mode: "delivery" | "dine_in" | "both"; order_via: string | null } | null;
    dishes: { name: string; price: number | null; veg: boolean | null; calories: number; protein_g: number; carbs_g: number; fat_g: number; goTo: boolean }[];
    orders: { ordered_on: string; items: string; total: number | null }[];
  }[];
};

export function planImport(
  input: Place[],
  existing: { places: ExistingPlace[]; dishes: { place_id: string; name: string }[]; orders: { place_id: string | null; ordered_on: string; items: string }[] },
  today: string,
): ImportPlan {
  const byKey = new Map(existing.places.map((p) => [placeKey(p.name), p]));
  // Merge entries for the same place (the AI may split one place across screenshots).
  const merged = new Map<string, Place>();
  for (const p of input) {
    const k = placeKey(p.name);
    if (!k) continue;
    const cur = merged.get(k);
    if (cur) merged.set(k, { ...cur, cuisine: cur.cuisine ?? p.cuisine, area: cur.area ?? p.area, platform: cur.platform ?? p.platform, orders: [...cur.orders, ...p.orders] });
    else merged.set(k, p);
  }
  const haveOrder = new Set(existing.orders.map((o) => `${o.place_id}|${o.ordered_on}|${o.items.toLowerCase()}`));

  return {
    places: [...merged].map(([key, p]) => {
      const match = byKey.get(key) ?? null;
      const onMenu = new Set(match ? existing.dishes.filter((d) => d.place_id === match.id).map((d) => dishKey(d.name)) : []);
      // The same order can show up in two screenshots: drop repeats (and ones imported before) first.
      const seenOrder = new Set<string>();
      const unique = p.orders
        .filter((o) => o.items.length)
        .map((o) => ({ ...o, ordered_on: o.date && o.date <= today ? o.date : today, text: orderText(o.items) }))
        .filter((o) => {
          const k = `${o.ordered_on}|${o.text.toLowerCase()}`;
          if (seenOrder.has(k)) return false;
          seenOrder.add(k);
          return true;
        });
      // Each dish once; ordered in 2+ separate orders = a go-to.
      const dishes = new Map<string, ImportPlan["places"][number]["dishes"][number] & { times: number }>();
      for (const o of unique) {
        for (const k of new Set(o.items.map((i) => dishKey(i.name)))) {
          const it = o.items.find((i) => dishKey(i.name) === k)!;
          const d = dishes.get(k);
          if (d) d.times += 1;
          else dishes.set(k, { name: it.name.trim(), price: it.price, veg: it.veg, calories: it.calories, protein_g: it.protein_g, carbs_g: it.carbs_g, fat_g: it.fat_g, goTo: false, times: 1 });
        }
      }
      const orders = unique
        .filter((o) => !(match && haveOrder.has(`${match.id}|${o.ordered_on}|${o.text.toLowerCase()}`)))
        .map((o) => ({ ordered_on: o.ordered_on, items: o.text, total: o.total }));
      const delivery = p.platform && !["dine_in", "other", "direct"].includes(p.platform);
      return {
        key,
        existingId: match?.id ?? null,
        insert: match ? null : { name: p.name.trim(), cuisine: p.cuisine, area: p.area, mode: p.platform === "dine_in" ? "dine_in" : delivery ? "delivery" : "both", order_via: (p.platform && PLATFORM_LABEL[p.platform]) || null },
        dishes: [...dishes.entries()].filter(([k]) => !onMenu.has(k)).map(([, { times, ...d }]) => ({ ...d, goTo: times >= 2 })),
        orders,
      };
    }),
  };
}
