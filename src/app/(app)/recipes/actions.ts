"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { mealIdeaSchema, MEALS } from "@/lib/ai/phase2-schemas";
import { GROCERY_CATEGORIES, type ActionResult } from "@/lib/types";
import { guessCategory } from "@/modules/groceries/meta";
import { normalizeName } from "@/modules/pantry/match";
import { addFoodItems } from "@/app/(app)/food/actions";

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

/** Logs servings of a recipe to someone's food diary. */
export async function logRecipe(recipeId: string, ownerId: string, meal: (typeof MEALS)[number], servings: number): Promise<ActionResult> {
  const session = await getSession();
  const { data: r } = await session.supabase.from("recipes").select("*").eq("id", recipeId).maybeSingle();
  if (!r) return { error: "Recipe not found." };
  const n = Math.min(10, Math.max(0.25, Number(servings) || 1));
  const scale = (v: number | null) => (v == null ? 0 : Math.round(Number(v) * n * 10) / 10);
  return addFoodItems(
    ownerId,
    meal,
    [{ description: r.title, quantity: `${n} serving${n === 1 ? "" : "s"}`, calories: Math.round(scale(r.calories_per_serving)), protein_g: scale(r.protein_g), carbs_g: scale(r.carbs_g), fat_g: scale(r.fat_g), fiber_g: 0 }],
    "recipe",
    undefined,
    recipeId,
  );
}
