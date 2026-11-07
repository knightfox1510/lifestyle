import { STAPLES } from "./staples";
import { DISHES } from "./dishes";

/**
 * For a typed meal, the built-in staples and dishes its words point to (pure;
 * unit-tested), so the AI prompt lists those instead of all ~370. Matching is
 * on key, name and the regional aliases, by whole word or a shared start of
 * 4+ letters ("pohe" ~ "poha", "chapatis" ~ "chapati").
 */
const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3);

/** Everyday cooking ingredients, always offered so an unknown dish can still be broken down. */
const CORE = ["oil_sunflower", "ghee", "butter", "salt", "sugar", "onion", "tomato", "garlic", "ginger", "green_chilli", "red_chilli_powder", "coriander", "curry_leaves", "lemon_juice", "milk_toned", "curd", "cream", "atta", "rice_white", "rice_cooked", "potato", "besan", "jaggery", "coconut_fresh", "peanuts", "water"];

const near = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, Math.max(4, b.length - 2))) || b.startsWith(a.slice(0, Math.max(4, a.length - 2)))));

export function relevantFoods(text: string, maxDishes = 30) {
  const ws = words(text);
  const hit = (hay: string) => {
    const hw = words(hay);
    return ws.filter((w) => hw.some((h) => near(w, h))).length;
  };
  const dishes = DISHES.map((d) => ({ d, score: hit(`${d.key.replace(/_/g, " ")} ${d.name} ${d.aliases}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDishes)
    .map((x) => x.d);
  const staples = new Set(CORE.filter((k) => STAPLES.some((s) => s.key === k)));
  for (const s of STAPLES) if (hit(`${s.key.replace(/_/g, " ")} ${s.name} ${s.aliases}`)) staples.add(s.key);
  for (const d of dishes) for (const [k] of d.ingredients) staples.add(k);
  return { dishes, staples };
}

/** Whether a name (a household food or recipe) shares a word with the typed meal. */
export function mentions(text: string, name: string) {
  const ws = words(text);
  const hw = words(name);
  return ws.some((w) => hw.some((h) => near(w, h)));
}
