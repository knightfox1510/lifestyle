"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { foodItemSchema, MEALS, nutritionGoalSchema } from "@/lib/ai/phase2-schemas";
import type { ActionResult } from "@/lib/types";
import { NUTRIENT_KEYS, scale, splitMacros, type Nutrients } from "@/modules/nutrition/nutrients";
import { cleanIrritants } from "@/modules/nutrition/irritants";

const MODULE = "food_diary";
const when = z.iso.datetime({ offset: true }).optional();
const blank = (v: unknown) => (v === "" || v == null ? null : v);
const optNum = (max: number) => z.preprocess(blank, z.coerce.number().min(0).max(max).nullable());

/** Saves one or more food items (from AI estimate, recipe or re-add). */
export async function addFoodItems(
  ownerId: string,
  meal: (typeof MEALS)[number],
  items: unknown,
  source: "ai_estimate" | "photo" | "recipe" | "manual" | "restaurant",
  eatenAt?: string,
  recipeId?: string | null,
  dishId?: string | null,
): Promise<ActionResult> {
  if (dishId != null && !z.uuid().safeParse(dishId).success) return { error: "Invalid dish." };
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
        dish_id: dishId ?? null,
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
export async function repeatFood(entryId: string, ownerId: string, meal: (typeof MEALS)[number], eatenAt?: string) {
  const session = await requireWrite(MODULE, ownerId);
  const { data } = await session.supabase.from("food_entries").select("*").eq("id", entryId).single();
  if (!data || !MEALS.includes(meal) || !when.safeParse(eatenAt).success) return;
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
    micros: data.micros ?? {},
    grams: data.grams,
    accuracy: data.accuracy ?? "estimated",
    irritants: data.irritants ?? [],
    ...(eatenAt ? { eaten_at: eatenAt } : {}),
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

// ------------------------------------------------- detailed / shared logging --

const nutrientsSchema = z
  .record(z.string(), z.number().min(0).max(100000))
  .transform((n) => Object.fromEntries(Object.entries(n).filter(([k]) => (NUTRIENT_KEYS as readonly string[]).includes(k))) as Nutrients);

const detailedItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.string().trim().max(60).nullable(),
  grams: z.number().min(0).max(10000).nullable(),
  nutrients: nutrientsSchema,
  accuracy: z.enum(["calculated", "label", "estimated"]),
  irritants: z.array(z.string()).max(8),
  recipe_id: z.uuid().nullable().optional(),
  dish_id: z.uuid().nullable().optional(),
  source: z.enum(["ai_estimate", "photo", "recipe", "manual", "restaurant"]),
});
export type DetailedItem = z.input<typeof detailedItemSchema>;

const peopleSchema = z.array(z.object({ ownerId: z.uuid(), factor: z.number().min(0.1).max(5) })).min(1).max(8);

/**
 * Logs items (with micronutrients) for one or more people, each with their
 * own portion factor. One cooked meal → one row per person, linked by group_id.
 */
export async function logFoodForPeople(people: unknown, meal: (typeof MEALS)[number], items: unknown, eatenAt?: string): Promise<ActionResult> {
  const p = peopleSchema.safeParse(people);
  const it = z.array(detailedItemSchema).min(1).max(20).safeParse(items);
  if (!p.success || !it.success || !MEALS.includes(meal) || !when.safeParse(eatenAt).success) return { error: "Some items are invalid." };
  const session = await getSession();
  if (!session.isModuleEnabled(MODULE)) return { error: "Food diary is turned off." };
  const allowed = p.data.filter((x) => session.accessTo(MODULE, x.ownerId) === "write");
  if (!allowed.length) return { error: "You can't log food for that person." };
  const groupId = allowed.length > 1 ? crypto.randomUUID() : null;
  const at = eatenAt ?? new Date().toISOString();

  const rows = allowed.flatMap((person) =>
    it.data.map((i) => {
      const n = person.factor === 1 ? i.nutrients : scale(i.nutrients, person.factor);
      const { calories, protein_g, carbs_g, fat_g, fiber_g, micros } = splitMacros(n);
      return {
        owner_id: person.ownerId,
        created_by: session.userId,
        household_id: session.household.id,
        meal,
        eaten_at: at,
        description: i.description,
        quantity: person.factor === 1 ? i.quantity : `${i.quantity ? `${i.quantity}, ` : ""}${Math.round(person.factor * 100)}% portion`.slice(0, 60),
        grams: i.grams ? Math.round(i.grams * person.factor * 10) / 10 : null,
        calories: Math.min(5000, calories),
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
        micros,
        accuracy: i.accuracy,
        irritants: cleanIrritants(i.irritants),
        recipe_id: i.recipe_id ?? null,
        dish_id: i.dish_id ?? null,
        source: i.source,
        group_id: groupId,
      };
    }),
  );
  const { error } = await session.supabase.from("food_entries").insert(rows);
  if (error) return { error: "Couldn't save." };
  refreshModule("/food");
  const names = allowed.map((x) => (x.ownerId === session.userId ? "you" : session.members.find((m) => m.user_id === x.ownerId)?.display_name ?? "partner"));
  return { ok: true, message: `Logged ${it.data.length} item${it.data.length === 1 ? "" : "s"} for ${names.join(" and ")}.` };
}

// ---------------------------------------------------------- household foods --

const foodSchema = z.object({
  id: z.uuid().nullable().optional(),
  name: z.string().trim().min(1, "Name the food").max(120),
  brand: z.string().trim().max(80).nullable().optional(),
  barcode: z.string().regex(/^\d{6,14}$/).nullable().optional(),
  source: z.enum(["manual", "label", "openfoodfacts", "usda"]),
  serving_g: z.number().min(0.1).max(5000).nullable().optional(),
  serving_label: z.string().trim().max(40).nullable().optional(),
  nutrients: nutrientsSchema,
  irritants: z.array(z.string()).max(8).optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});

/** Saves (or updates) one of the household's own foods. Values are per 100 g. */
export async function saveCustomFood(input: unknown): Promise<ActionResult & { id?: string }> {
  const parsed = foodSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, irritants, ...values } = parsed.data;
  const session = await getSession();
  const row = { ...values, irritants: cleanIrritants(irritants ?? []), household_id: session.household.id };
  const res = id
    ? await session.supabase.from("custom_foods").update(row).eq("id", id).eq("household_id", session.household.id).select("id").single()
    : await session.supabase.from("custom_foods").insert({ ...row, created_by: session.userId }).select("id").single();
  if (res.error || !res.data) return { error: res.error?.code === "23505" ? "A food with that barcode is already saved." : "Couldn't save the food." };
  refreshModule("/food");
  return { ok: true, id: res.data.id, message: "Saved to your foods." };
}

export async function deleteCustomFood(id: string) {
  const session = await getSession();
  await session.supabase.from("custom_foods").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/food");
}
