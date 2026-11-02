"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { mealIdeaSchema, MEALS } from "@/lib/ai/phase2-schemas";
import { GROCERY_CATEGORIES, type ActionResult, type Recipe } from "@/lib/types";
import { guessCategory } from "@/modules/groceries/meta";
import { normalizeName } from "@/modules/pantry/match";
import { logFoodForPeople } from "@/app/(app)/food/actions";
import { forGrams, scale, sum, type Nutrients } from "@/modules/nutrition/nutrients";
import { cleanIrritants } from "@/modules/nutrition/irritants";
import { DISH_BY_KEY, dishNutrition } from "@/modules/nutrition/dishes";
import { STAPLE_BY_KEY } from "@/modules/nutrition/staples";
import { addDays, todayIn } from "@/lib/dates";

const ingredient = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.string().trim().max(60).nullable(),
  category: z.enum(GROCERY_CATEGORIES),
});
const blank = (v: unknown) => (v === "" || v == null ? null : v);

const recipeSchema = z.object({
  id: z.preprocess(blank, z.uuid().nullable()),
  title: z.string().trim().min(1, "Give it a name").max(150),
  description: z.preprocess(blank, z.string().trim().max(1000).nullable()),
  servings: z.coerce.number().int().min(1).max(20),
  prep_minutes: z.preprocess(blank, z.coerce.number().int().min(0).max(1440).nullable()),
  cook_minutes: z.preprocess(blank, z.coerce.number().int().min(0).max(1440).nullable()),
  calories_per_serving: z.preprocess(blank, z.coerce.number().int().min(0).max(5000).nullable()),
  protein_g: z.preprocess(blank, z.coerce.number().min(0).max(500).nullable()),
  carbs_g: z.preprocess(blank, z.coerce.number().min(0).max(1000).nullable()),
  fat_g: z.preprocess(blank, z.coerce.number().min(0).max(500).nullable()),
  source_url: z.preprocess(blank, z.url().max(500).nullable()),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  ingredients: z.array(ingredient).max(60),
  steps: z.array(z.string().trim().min(1).max(1000)).max(40),
});

/** Ingredients as one per line: "quantity | name" or just "name". */
function parseIngredients(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, b] = l.includes("|") ? l.split("|").map((x) => x.trim()) : [null, l];
      const name = (b || a || "").slice(0, 80);
      return { name, quantity: b ? (a || null) : null, category: guessCategory(name) };
    });
}

export async function saveRecipe(_: ActionResult | null, form: FormData): Promise<ActionResult & { id?: string }> {
  const parsed = recipeSchema.safeParse({
    ...Object.fromEntries(form),
    tags: String(form.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    ingredients: parseIngredients(String(form.get("ingredients") ?? "")),
    steps: String(form.get("steps") ?? "").split("\n").map((s) => s.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...values } = parsed.data;
  try {
    const session = await requireModule("recipes");
    const res = id
      ? await session.supabase.from("recipes").update(values).eq("id", id).eq("household_id", session.household.id).select("id").single()
      : await session.supabase.from("recipes").insert({ ...values, household_id: session.household.id, created_by: session.userId }).select("id").single();
    if (res.error || !res.data) return { error: "Couldn't save the recipe." };
    refreshModule("/recipes");
    return { ok: true, message: "Recipe saved.", id: res.data.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function saveIdeaAsRecipe(idea: unknown): Promise<ActionResult & { id?: string }> {
  const parsed = mealIdeaSchema.safeParse(idea);
  if (!parsed.success) return { error: "Invalid recipe" };
  const i = parsed.data;
  try {
    const session = await requireModule("recipes");
    const { data, error } = await session.supabase
      .from("recipes")
      .insert({
        household_id: session.household.id,
        created_by: session.userId,
        title: i.title,
        description: i.why,
        servings: i.servings,
        prep_minutes: i.prep_minutes,
        cook_minutes: i.cook_minutes,
        calories_per_serving: i.calories_per_serving,
        protein_g: i.protein_g,
        carbs_g: i.carbs_g,
        fat_g: i.fat_g,
        ingredients: i.ingredients.map(({ name, quantity, category }) => ({ name, quantity, category })),
        steps: i.steps,
        tags: i.tags,
        ai_generated: true,
      })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't save." };
    refreshModule("/recipes");
    return { ok: true, message: "Saved to recipes.", id: data.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function toggleFavorite(id: string, favorite: boolean) {
  const session = await requireModule("recipes");
  await session.supabase.from("recipes").update({ favorite }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/recipes");
}

export async function deleteRecipe(id: string) {
  const session = await requireModule("recipes");
  await session.supabase.from("recipes").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/recipes");
}

/** Adds items to the shared grocery list, skipping ones already on it (unchecked). */
export async function addToGroceryList(items: unknown): Promise<ActionResult> {
  const parsed = z.array(z.object({ name: z.string().trim().min(1).max(120), quantity: z.string().trim().max(40).nullable().optional(), category: z.enum(GROCERY_CATEGORIES).optional() })).min(1).max(100).safeParse(items);
  if (!parsed.success) return { error: "Nothing to add." };
  try {
    const session = await requireModule("groceries");
    const { data: existing } = await session.supabase
      .from("grocery_items")
      .select("name")
      .eq("household_id", session.household.id)
      .is("deleted_at", null)
      .eq("checked", false);
    const have = new Set((existing ?? []).map((e: { name: string }) => normalizeName(e.name)));
    const rows = parsed.data
      .filter((i) => !have.has(normalizeName(i.name)))
      .map((i) => ({
        id: crypto.randomUUID(),
        household_id: session.household.id,
        created_by: session.userId,
        name: i.name,
        quantity: i.quantity ?? null,
        category: i.category ?? guessCategory(i.name),
      }));
    if (rows.length) {
      const { error } = await session.supabase.from("grocery_items").insert(rows);
      if (error) return { error: "Couldn't update the grocery list." };
    }
    refreshModule("/groceries");
    const skipped = parsed.data.length - rows.length;
    return { ok: true, message: `Added ${rows.length} to the grocery list${skipped ? ` (${skipped} already there)` : ""}.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const planSchema = z.object({
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(MEALS),
  recipe_id: z.preprocess(blank, z.uuid().nullable()),
  title: z.preprocess(blank, z.string().trim().max(150).nullable()),
  servings: z.coerce.number().int().min(1).max(20),
});

export async function addToPlan(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = planSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || (!parsed.data.recipe_id && !parsed.data.title)) return { error: "Pick a recipe or type a dish." };
  try {
    const session = await requireModule("recipes");
    const { error } = await session.supabase.from("meal_plan").insert({ ...parsed.data, household_id: session.household.id, created_by: session.userId });
    if (error) return { error: "Couldn't add to the plan." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/recipes");
  return { ok: true, message: "Planned." };
}

export async function removeFromPlan(id: string) {
  const session = await requireModule("recipes");
  await session.supabase.from("meal_plan").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/recipes");
}

/** Per-serving nutrition for a recipe: calculated values if available, else the typed macros. */
function recipeServingNutrients(r: Recipe): { nutrients: Nutrients; accuracy: "calculated" | "estimated" } {
  if (r.nutrition && typeof r.nutrition.calories === "number") return { nutrients: r.nutrition as Nutrients, accuracy: "calculated" };
  return {
    nutrients: { calories: Number(r.calories_per_serving ?? 0), protein_g: Number(r.protein_g ?? 0), carbs_g: Number(r.carbs_g ?? 0), fat_g: Number(r.fat_g ?? 0) },
    accuracy: "estimated",
  };
}

/** Logs a recipe for one or more people, each with their own number of servings. */
export async function logRecipeForPeople(recipeId: string, people: { ownerId: string; servings: number }[], meal: (typeof MEALS)[number], eatenAt?: string): Promise<ActionResult> {
  const session = await getSession();
  const { data } = await session.supabase.from("recipes").select("*").eq("id", recipeId).eq("household_id", session.household.id).maybeSingle();
  if (!data) return { error: "Recipe not found." };
  const r = data as Recipe;
  const { nutrients, accuracy } = recipeServingNutrients(r);
  const servingG = r.total_weight_g ? Number(r.total_weight_g) / r.servings : null;
  const clean = people.filter((p) => p.servings > 0).map((p) => ({ ownerId: p.ownerId, factor: Math.min(5, Math.max(0.1, p.servings)) }));
  if (!clean.length) return { error: "Choose how much each person ate." };
  return logFoodForPeople(
    clean,
    meal,
    [
      {
        description: r.title,
        quantity: "1 serving",
        grams: servingG ? Math.round(servingG) : null,
        nutrients,
        accuracy,
        irritants: r.irritants ?? [],
        recipe_id: r.id,
        source: "recipe",
      },
    ],
    eatenAt,
  );
}

/** Logs servings of a recipe to someone's food diary. */
export async function logRecipe(recipeId: string, ownerId: string, meal: (typeof MEALS)[number], servings: number): Promise<ActionResult> {
  return logRecipeForPeople(recipeId, [{ ownerId, servings: Number(servings) || 1 }], meal);
}

// -------------------------------------------------- nutrition calculator --

const calcRowSchema = z.object({
  index: z.number().int().min(0).max(99),
  grams: z.number().min(0).max(20000),
  ref: z
    .union([
      z.object({ kind: z.literal("staple"), key: z.string().max(40) }),
      z.object({ kind: z.literal("custom"), id: z.uuid() }),
      z.object({ kind: z.literal("usda"), id: z.string().regex(/^\d{1,10}$/) }),
      z.object({ kind: z.literal("recipe"), id: z.uuid() }),
    ])
    .nullable(),
  match_name: z.string().max(200).nullable(),
  per100: z.record(z.string(), z.number().min(0).max(100000)).nullable(),
});

/**
 * Saves the ingredient grams/matches and the resulting per-serving nutrition
 * (macros + micronutrients). Nutrition is recomputed here from the rows.
 */
export async function saveRecipeNutrition(recipeId: string, input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ rows: z.array(calcRowSchema).max(60), total_weight_g: z.number().min(1).max(50000).nullable(), irritants: z.array(z.string()).max(8) })
    .safeParse(input);
  if (!parsed.success) return { error: "Some ingredient rows are invalid." };
  const session = await requireModule("recipes");
  const { data } = await session.supabase.from("recipes").select("*").eq("id", recipeId).eq("household_id", session.household.id).maybeSingle();
  if (!data) return { error: "Recipe not found." };
  const r = data as Recipe;

  const byIndex = new Map(parsed.data.rows.map((row) => [row.index, row]));
  const ingredients = r.ingredients.map((ing, i) => {
    const row = byIndex.get(i);
    return row ? { ...ing, grams: row.grams, ref: row.ref, match_name: row.match_name, per100: row.per100 } : ing;
  });
  const used = ingredients.filter((i) => (i.grams ?? 0) > 0);
  const unmatched = used.filter((i) => !i.per100 || typeof i.per100.calories !== "number");
  if (!used.length) return { error: "Add grams for at least one ingredient." };
  if (unmatched.length) return { error: `Match a food for: ${unmatched.map((u) => u.name).join(", ")} (or set its grams to 0).` };

  const total = sum(used.map((i) => forGrams(i.per100 as Nutrients, i.grams!)));
  const perServing = scale(total, 1 / r.servings);
  const { error } = await session.supabase
    .from("recipes")
    .update({
      ingredients,
      nutrition: perServing,
      total_weight_g: parsed.data.total_weight_g,
      irritants: cleanIrritants(parsed.data.irritants),
      calories_per_serving: Math.round(perServing.calories ?? 0),
      protein_g: perServing.protein_g ?? null,
      carbs_g: perServing.carbs_g ?? null,
      fat_g: perServing.fat_g ?? null,
    })
    .eq("id", recipeId);
  if (error) return { error: "Couldn't save the nutrition." };
  refreshModule("/recipes");
  return { ok: true, message: `Calculated: ${Math.round(perServing.calories ?? 0)} kcal and ${perServing.protein_g ?? 0} g protein per serving.` };
}

// ----------------------------------------------------------- cooked + leftovers --

/**
 * "We cooked this": log what each person ate and put the remaining portions
 * in the fridge as a leftover (2-day expiry by default).
 */
export async function cookedRecipe(recipeId: string, input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      meal: z.enum(MEALS),
      made: z.number().min(0.5).max(40),
      people: z.array(z.object({ ownerId: z.uuid(), servings: z.number().min(0).max(5) })).max(8),
      leftoverDays: z.number().int().min(1).max(7),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Check the portions." };
  const { meal, made, people, leftoverDays } = parsed.data;
  const session = await getSession();
  const eaten = people.reduce((a, p) => a + p.servings, 0);
  let logMsg = "";
  if (eaten > 0) {
    const res = await logRecipeForPeople(recipeId, people, meal);
    if (res.error) return res;
    logMsg = res.message ?? "";
  }
  const left = Math.round((made - eaten) * 100) / 100;
  if (left > 0 && session.isModuleEnabled("pantry")) {
    const { data: r } = await session.supabase.from("recipes").select("title").eq("id", recipeId).eq("household_id", session.household.id).single();
    const today = todayIn(session.profile.timezone);
    const { error } = await session.supabase.from("pantry_items").insert({
      household_id: session.household.id,
      created_by: session.userId,
      name: `Leftover: ${r?.title ?? "dish"}`.slice(0, 120),
      quantity: `${left} portion${left === 1 ? "" : "s"}`,
      category: "other",
      location: "fridge",
      purchased_on: today,
      expires_on: addDays(today, leftoverDays),
      expiry_estimated: true,
      recipe_id: recipeId,
      portions: left,
    });
    if (error) return { error: "Logged, but couldn't save the leftovers." };
    refreshModule("/pantry");
    return { ok: true, message: `${logMsg} ${left} portion${left === 1 ? "" : "s"} saved to the fridge.`.trim() };
  }
  return { ok: true, message: logMsg || "Done." };
}

// ------------------------------------------------------ built-in Indian dishes --

/**
 * Copies a built-in dish into the household's recipes (2 servings) with
 * ingredient grams already matched, so it can be tweaked to how you cook it.
 */
export async function copyDishToRecipes(dishKey: string): Promise<ActionResult & { id?: string }> {
  const d = DISH_BY_KEY[dishKey];
  if (!d) return { error: "Unknown dish." };
  try {
    const session = await requireModule("recipes");
    const servings = 2;
    const ingredients = d.ingredients.map(([key, g]) => {
      const s = STAPLE_BY_KEY[key];
      return { name: s.name, quantity: `${g * servings} g`, category: guessCategory(s.name), grams: g * servings, ref: { kind: "staple", key }, match_name: s.name, per100: s.per100 };
    });
    const perServing = dishNutrition(d);
    const { data, error } = await session.supabase
      .from("recipes")
      .insert({
        household_id: session.household.id,
        created_by: session.userId,
        title: d.name,
        description: `Standard home recipe (${d.serving} per serving). Adjust grams to how you make it.`,
        servings,
        ingredients,
        steps: [],
        tags: ["indian", d.region.toLowerCase()],
        nutrition: perServing,
        total_weight_g: d.servingG * servings,
        irritants: d.irritants ?? [],
        calories_per_serving: Math.round(perServing.calories ?? 0),
        protein_g: perServing.protein_g ?? null,
        carbs_g: perServing.carbs_g ?? null,
        fat_g: perServing.fat_g ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't copy the dish." };
    refreshModule("/recipes");
    return { ok: true, id: data.id, message: "Copied to your recipes." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
