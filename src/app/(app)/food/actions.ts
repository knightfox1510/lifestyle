"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { foodItemSchema, MEALS, nutritionGoalSchema } from "@/lib/ai/phase2-schemas";
import type { ActionResult } from "@/lib/types";
import { NUTRIENT_KEYS, scale, splitMacros, type Nutrients } from "@/modules/nutrition/nutrients";
import { cleanIrritants } from "@/modules/nutrition/irritants";
import { addDays, localDate, localTime, zonedIso } from "@/lib/dates";
import { dishKey } from "@/modules/food/plan";

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

/**
 * Deletes a logged food. The person it belongs to can always; whoever logged
 * it (e.g. a partner logging a shared meal) can while they have write access.
 */
export async function deleteFood(id: string, ownerId: string): Promise<ActionResult> {
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data, error } = await session.supabase.from("food_entries").delete().eq("id", id).eq("owner_id", ownerId).select("id");
    if (error || !data?.length) return { error: "Only the person it belongs to, or whoever logged it, can delete this." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/food");
  return { ok: true, message: "Deleted." };
}

const editSchema = z.object({
  description: z.string().trim().min(1, "Give it a name").max(200),
  quantity: z.preprocess(blank, z.string().trim().max(60).nullable()),
  meal: z.enum(MEALS),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time"),
  /** Portion change: 0.5 = half of what was logged, 2 = double. Nutrients and grams scale with it. */
  factor: z.number().min(0.1).max(10),
});

/** Rename a logged food, change the amount, move it to another meal or time (same day). */
export async function updateFoodEntry(id: string, ownerId: string, input: unknown): Promise<ActionResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const v = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data: e } = await session.supabase.from("food_entries").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (!e) return { error: "Entry not found." };
    const tz = session.profile.timezone;
    const date = localDate(e.eaten_at, tz);
    const f = v.factor;
    const r1 = (n: unknown) => (n == null ? null : Math.round(Number(n) * f * 10) / 10);
    const micros = Object.fromEntries(Object.entries((e.micros ?? {}) as Record<string, number>).map(([k, n]) => [k, Math.round(Number(n) * f * 100) / 100]));
    const patch = {
      description: v.description,
      quantity: v.quantity,
      meal: v.meal,
      eaten_at: zonedIso(date, v.time, tz),
      ...(f !== 1
        ? {
            calories: e.calories == null ? null : Math.min(5000, Math.round(Number(e.calories) * f)),
            protein_g: r1(e.protein_g),
            carbs_g: r1(e.carbs_g),
            fat_g: r1(e.fat_g),
            fiber_g: r1(e.fiber_g),
            grams: e.grams == null ? null : Math.min(10000, r1(e.grams) ?? 0),
            micros,
          }
        : {}),
    };
    const { error } = await session.supabase.from("food_entries").update(patch).eq("id", id).eq("owner_id", ownerId);
    if (error) return { error: "Couldn't save the changes." };
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshModule("/food");
  return { ok: true, message: "Saved." };
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

/** Copies everything from one meal on an earlier day (e.g. yesterday's breakfast) to the same meal on `toDate`. */
export async function copyMeal(ownerId: string, fromDate: string, meal: (typeof MEALS)[number], toDate: string): Promise<ActionResult> {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(fromDate) || !iso.test(toDate) || !MEALS.includes(meal)) return { error: "Pick a meal." };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const tz = session.profile.timezone;
    const { data } = await session.supabase
      .from("food_entries")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("meal", meal)
      .gte("eaten_at", zonedIso(fromDate, "00:00", tz))
      .lt("eaten_at", zonedIso(addDays(fromDate, 1), "00:00", tz));
    const rows = (data ?? []) as Record<string, unknown>[];
    if (!rows.length) return { error: "Nothing was logged for that meal." };
    const now = Date.now();
    const shift = (at: string) => {
      const t = zonedIso(toDate, localTime(at, tz), tz);
      return Date.parse(t) > now ? new Date(now).toISOString() : t;
    };
    const { error } = await session.supabase.from("food_entries").insert(
      rows.map((e) => ({
        owner_id: ownerId,
        created_by: session.userId,
        household_id: session.household.id,
        meal,
        eaten_at: shift(String(e.eaten_at)),
        description: e.description,
        quantity: e.quantity,
        calories: e.calories,
        protein_g: e.protein_g,
        carbs_g: e.carbs_g,
        fat_g: e.fat_g,
        fiber_g: e.fiber_g,
        recipe_id: e.recipe_id,
        source: e.source,
        micros: e.micros ?? {},
        grams: e.grams,
        accuracy: e.accuracy ?? "estimated",
        irritants: e.irritants ?? [],
      })),
    );
    if (error) return { error: "Couldn't copy the meal." };
    refreshModule("/food");
    return { ok: true, message: `Added ${rows.length} item${rows.length === 1 ? "" : "s"}.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const rememberSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(200),
      ref: z.record(z.string(), z.unknown()),
      per100: z.record(z.string(), z.number().min(0).max(100000)),
      source: z.string().max(40).nullable(),
      fixed: z.boolean(),
    }),
  )
  .max(40);

/**
 * Remembers the food each logged ingredient was matched to, so the same name
 * gets the same numbers next time. One you picked yourself ("fixed") is never
 * replaced by an automatic match.
 */
export async function rememberFoods(input: unknown): Promise<ActionResult> {
  const parsed = rememberSchema.safeParse(input);
  if (!parsed.success || !parsed.data.length) return { ok: true };
  try {
    const session = await getSession();
    const keys = [...new Set(parsed.data.map((c) => dishKey(c.name)).filter(Boolean))];
    const { data: existing, error: readError } = await session.supabase.from("food_aliases").select("name_key, confirmed, uses").eq("household_id", session.household.id).in("name_key", keys);
    if (readError) return { ok: true }; // database not updated yet: nothing to remember
    const have = new Map(((existing ?? []) as { name_key: string; confirmed: boolean; uses: number }[]).map((e) => [e.name_key, e]));
    const rows = new Map<string, Record<string, unknown>>();
    for (const c of parsed.data) {
      const key = dishKey(c.name);
      if (!key || c.per100.calories === undefined) continue;
      const prev = have.get(key);
      if (prev?.confirmed && !c.fixed) continue;
      rows.set(key, {
        household_id: session.household.id,
        name_key: key,
        label: c.label,
        ref: c.ref,
        per100: c.per100,
        source: c.source,
        confirmed: c.fixed || Boolean(prev?.confirmed),
        uses: (prev?.uses ?? 0) + 1,
        created_by: session.userId,
        updated_at: new Date().toISOString(),
      });
    }
    if (rows.size) await session.supabase.from("food_aliases").upsert([...rows.values()], { onConflict: "household_id,name_key" });
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/** Forget a remembered match (e.g. it was the wrong food). */
export async function forgetFood(nameKey: string): Promise<ActionResult> {
  const session = await getSession();
  const { error } = await session.supabase.from("food_aliases").delete().eq("household_id", session.household.id).eq("name_key", nameKey);
  if (error) return { error: "Couldn't remove it." };
  refreshModule("/food");
  return { ok: true, message: "Forgotten. It will be matched afresh next time." };
}
