import "server-only";

import type { AppSession } from "@/lib/session";
import type { CustomFood, FoodRef, Recipe } from "@/lib/types";
import { STAPLE_BY_KEY, searchStaples } from "@/modules/nutrition/staples";
import { DISH_BY_KEY, dishNutrition, dishPer100, searchDishes, type Dish } from "@/modules/nutrition/dishes";
import { parseFdcFood, type FdcSearchFood } from "@/modules/nutrition/sources";
import { NUTRIENT_KEYS, type Nutrients } from "@/modules/nutrition/nutrients";
import { cleanIrritants, type Irritant } from "@/modules/nutrition/irritants";

/** A food with nutrition we can compute from. per100 is per 100 g; recipes may only know per serving. */
export type ResolvedFood = {
  ref: FoodRef;
  name: string;
  source: "Built-in" | "Your foods" | "USDA" | "Recipe" | "Indian dish";
  per100: Nutrients | null;
  perServing?: Nutrients | null;
  servingG?: number | null;
  irritants: Irritant[];
};

const FDC = "https://api.nal.usda.gov/fdc/v1";
const usdaCache = new Map<string, ResolvedFood>();

function cleanNutrients(n: unknown): Nutrients {
  const out: Nutrients = {};
  if (!n || typeof n !== "object") return out;
  for (const k of NUTRIENT_KEYS) {
    const v = Number((n as Record<string, unknown>)[k]);
    if (Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

function fromCustom(f: CustomFood): ResolvedFood {
  return { ref: { kind: "custom", id: f.id }, name: f.brand && !f.name.includes(f.brand) ? `${f.name} (${f.brand})` : f.name, source: "Your foods", per100: cleanNutrients(f.nutrients), servingG: f.serving_g, irritants: cleanIrritants(f.irritants) };
}

function fromRecipe(r: Recipe): ResolvedFood | null {
  if (!r.nutrition) return null;
  const perServing = cleanNutrients(r.nutrition);
  const servingG = r.total_weight_g ? Number(r.total_weight_g) / r.servings : null;
  const per100 = servingG ? Object.fromEntries(Object.entries(perServing).map(([k, v]) => [k, (Number(v) * 100) / servingG])) : null;
  return { ref: { kind: "recipe", id: r.id }, name: r.title, source: "Recipe", per100: per100 as Nutrients | null, perServing, servingG, irritants: cleanIrritants(r.irritants) };
}

export function fromDish(d: Dish): ResolvedFood {
  return { ref: { kind: "dish", key: d.key }, name: d.name, source: "Indian dish", per100: dishPer100(d), perServing: dishNutrition(d), servingG: d.servingG, irritants: d.irritants ?? [] };
}

async function fdcFetch(path: string, timeoutMs = 5000): Promise<unknown | null> {
  const key = process.env.FDC_API_KEY || "DEMO_KEY";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${FDC}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`, { signal: ctrl.signal, next: { revalidate: 86400 } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function usdaSearch(query: string, limit = 6): Promise<ResolvedFood[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const body = (await fdcFetch(`/foods/search?query=${encodeURIComponent(q)}&pageSize=${limit}&dataType=${encodeURIComponent("Foundation,SR Legacy")}`)) as { foods?: FdcSearchFood[] } | null;
  return (body?.foods ?? []).map((f) => {
    const p = parseFdcFood(f);
    const r: ResolvedFood = { ref: { kind: "usda", id: p.id }, name: p.name, source: "USDA", per100: p.per100, irritants: [] };
    usdaCache.set(p.id, r);
    return r;
  });
}

async function usdaById(id: string): Promise<ResolvedFood | null> {
  if (!/^\d{1,10}$/.test(id)) return null;
  const hit = usdaCache.get(id);
  if (hit) return hit;
  const body = (await fdcFetch(`/food/${id}?format=abridged`)) as FdcSearchFood | null;
  if (!body?.fdcId) return null;
  const p = parseFdcFood(body);
  const r: ResolvedFood = { ref: { kind: "usda", id: p.id }, name: p.name, source: "USDA", per100: p.per100, irritants: [] };
  usdaCache.set(id, r);
  return r;
}

/** Loads the household's own foods and recipes once per request. */
export async function householdFoods(session: AppSession) {
  const [{ data: foods }, { data: recipes }] = await Promise.all([
    session.supabase.from("custom_foods").select("*").eq("household_id", session.household.id).order("name").limit(500),
    session.isModuleEnabled("recipes")
      ? session.supabase.from("recipes").select("id, title, servings, nutrition, total_weight_g, irritants").eq("household_id", session.household.id).not("nutrition", "is", null).limit(300)
      : Promise.resolve({ data: [] }),
  ]);
  return { foods: (foods ?? []) as CustomFood[], recipes: (recipes ?? []) as Recipe[] };
}

export async function resolveRef(session: AppSession, ref: FoodRef, cache?: Awaited<ReturnType<typeof householdFoods>>): Promise<ResolvedFood | null> {
  if (ref.kind === "staple") {
    const s = STAPLE_BY_KEY[ref.key];
    return s ? { ref, name: s.name, source: "Built-in", per100: s.per100, irritants: s.irritants } : null;
  }
  if (ref.kind === "dish") {
    const d = DISH_BY_KEY[ref.key];
    return d ? fromDish(d) : null;
  }
  if (ref.kind === "usda") return usdaById(ref.id);
  const hh = cache ?? (await householdFoods(session));
  if (ref.kind === "custom") {
    const f = hh.foods.find((x) => x.id === ref.id);
    return f ? fromCustom(f) : null;
  }
  const r = hh.recipes.find((x) => x.id === ref.id);
  return r ? fromRecipe(r) : null;
}

/** Search across your foods, recipes, Indian dishes, built-in staples and (optionally) USDA. */
export async function searchFoods(session: AppSession, query: string, opts: { usda?: boolean } = {}): Promise<ResolvedFood[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hh = await householdFoods(session);
  const mine = hh.foods.filter((f) => `${f.name} ${f.brand ?? ""}`.toLowerCase().includes(q)).slice(0, 6).map(fromCustom);
  const recipes = hh.recipes.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 4).map(fromRecipe).filter(Boolean) as ResolvedFood[];
  const dishes = searchDishes(q, 5).map(fromDish);
  const staples = searchStaples(q, 6).map((s) => ({ ref: { kind: "staple" as const, key: s.key }, name: s.name, source: "Built-in" as const, per100: s.per100, irritants: s.irritants }));
  const usda = opts.usda === false ? [] : await usdaSearch(query, 6);
  return [...mine, ...recipes, ...dishes, ...staples, ...usda];
}

/**
 * Best match for an ingredient named by the AI: a staple key it chose, one of
 * the household's foods by name, otherwise the top USDA result.
 */
export async function matchIngredient(
  session: AppSession,
  hint: { staple_key?: string | null; custom_food?: string | null; search?: string | null; name: string },
  hh: Awaited<ReturnType<typeof householdFoods>>,
): Promise<ResolvedFood | null> {
  if (hint.custom_food) {
    const n = hint.custom_food.toLowerCase().trim();
    const f = hh.foods.find((x) => x.name.toLowerCase() === n) ?? hh.foods.find((x) => x.name.toLowerCase().includes(n));
    if (f) return fromCustom(f);
  }
  if (hint.staple_key && STAPLE_BY_KEY[hint.staple_key]) return resolveRef(session, { kind: "staple", key: hint.staple_key });
  const staple = searchStaples(hint.name, 1)[0];
  const usda = await usdaSearch(hint.search || hint.name, 3);
  const best = usda.find((u) => u.per100?.calories !== undefined);
  if (best) return best;
  return staple ? { ref: { kind: "staple", key: staple.key }, name: staple.name, source: "Built-in", per100: staple.per100, irritants: staple.irritants } : null;
}
