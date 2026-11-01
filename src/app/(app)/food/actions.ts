"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { foodItemSchema, MEALS, nutritionGoalSchema } from "@/lib/ai/phase2-schemas";
import type { ActionResult } from "@/lib/types";

const MODULE = "food_diary";
const when = z.iso.datetime({ offset: true }).optional();
const blank = (v: unknown) => (v === "" || v == null ? null : v);
const optNum = (max: number) => z.preprocess(blank, z.coerce.number().min(0).max(max).nullable());

/** Saves one or more food items (from AI estimate, recipe or re-add). */
export async function addFoodItems(
  ownerId: string,
  meal: (typeof MEALS)[number],
  items: unknown,
  source: "ai_estimate" | "photo" | "recipe" | "manual",
  eatenAt?: string,
  recipeId?: string | null,
): Promise<ActionResult> {
  const parsed = z.array(foodItemSchema).min(1).max(20).safeParse(items);
  if (!parsed.success || !MEALS.includes(meal) || !when.safeParse(eatenAt).success) return { error: "Some items are invalid." };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase.from("food_entries").insert(
      parsed.data.map((i) => ({
        ...i,
        meal,
        source,
        recipe_id: recipeId ?? null,
        eaten_at: eatenAt ?? new Date().toISOString(),
        owner_id: ownerId,
        created_by: session.userId,
        household_id: session.household.id,
      })),
    );
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/food");
  return { ok: true, message: `Added ${parsed.data.length} item${parsed.data.length === 1 ? "" : "s"}.` };
}

const manualSchema = z.object({
  ownerId: z.uuid(),
  meal: z.enum(MEALS),
  description: z.string().trim().min(1, "What did you eat?").max(200),
  quantity: z.preprocess(blank, z.string().trim().max(60).nullable()),
  calories: z.preprocess(blank, z.coerce.number().int().min(0).max(5000).nullable()),
  protein_g: optNum(500),
  carbs_g: optNum(1000),
  fat_g: optNum(500),
  fiber_g: optNum(200),
  eaten_at: z.preprocess(blank, z.iso.datetime({ offset: true }).nullable()),
});

export async function addManualFood(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = manualSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, eaten_at, ...values } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase.from("food_entries").insert({
      ...values,
      eaten_at: eaten_at ?? new Date().toISOString(),
      source: "manual",
      owner_id: ownerId,
      created_by: session.userId,
      household_id: session.household.id,
    });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/food");
  return { ok: true, message: "Added." };
}

/** Logs a previous entry again, now. */
export async function repeatFood(entryId: string, ownerId: string, meal: (typeof MEALS)[number]) {
  const session = await requireWrite(MODULE, ownerId);
  const { data } = await session.supabase.from("food_entries").select("*").eq("id", entryId).single();
  if (!data || !MEALS.includes(meal)) return;
  await session.supabase.from("food_entries").insert({
    owner_id: ownerId,
    created_by: session.userId,
    household_id: session.household.id,
    meal,
    description: data.description,
    quantity: data.quantity,
    calories: data.calories,
    protein_g: data.protein_g,
    carbs_g: data.carbs_g,
    fat_g: data.fat_g,
    fiber_g: data.fiber_g,
    recipe_id: data.recipe_id,
    source: data.source,
  });
  refreshModule("/food");
}

export async function deleteFood(id: string) {
  const session = await getSession();
  await session.supabase.from("food_entries").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/food");
}

// ------------------------------------------------------------------ goals --

const goalsSchema = z.object({
  ownerId: z.uuid(),
  goal: z.enum(["lose", "maintain", "gain", "recomp"]),
  calories: z.preprocess(blank, z.coerce.number().int().min(800).max(6000).nullable()),
  protein_g: z.preprocess(blank, z.coerce.number().int().min(0).max(400).nullable()),
  carbs_g: z.preprocess(blank, z.coerce.number().int().min(0).max(800).nullable()),
  fat_g: z.preprocess(blank, z.coerce.number().int().min(0).max(300).nullable()),
  fiber_g: z.preprocess(blank, z.coerce.number().int().min(0).max(100).nullable()),
  water_ml: z.preprocess(blank, z.coerce.number().int().min(0).max(6000).nullable()),
  diet_type: z.enum(["any", "vegetarian", "eggetarian", "vegan", "jain", "pescatarian", "non_vegetarian"]),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  cooking_style: z.enum(["quick", "balanced", "elaborate", "meal_prep"]),
  cuisines: z.array(z.string().trim().min(1).max(30)).max(10),
  dislikes: z.preprocess(blank, z.string().trim().max(500).nullable()),
  rationale: z.preprocess(blank, z.string().max(2000).nullable()),
});

export async function saveNutritionGoals(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = goalsSchema.safeParse({
    ...Object.fromEntries(form),
    cuisines: String(form.get("cuisines") ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase
      .from("nutrition_goals")
      .upsert({ ...values, owner_id: ownerId, household_id: session.household.id }, { onConflict: "owner_id" });
    if (error) return { error: "Couldn't save goals." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/food");
  return { ok: true, message: "Goals saved." };
}

export type AiGoals = z.infer<typeof nutritionGoalSchema>;
