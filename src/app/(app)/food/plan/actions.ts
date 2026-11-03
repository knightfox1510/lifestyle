"use server";

import { z } from "zod";
import { dbErrorMessage, errorMessage, isMissingColumn, refreshModule } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { addDays } from "@/lib/dates";
import { MEALS } from "@/lib/ai/phase2-schemas";
import { GROCERY_CATEGORIES, type ActionResult, type MealPlanEntry } from "@/lib/types";
import { mealTimeOn } from "@/modules/food/meta";
import { planFor, portionFor } from "@/modules/food/plan";
import { logFoodForPeople } from "@/app/(app)/food/actions";
import { logRecipeForPeople } from "@/app/(app)/recipes/actions";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const entrySchema = z
  .object({
    plan_date: isoDate,
    meal: z.enum(MEALS),
    recipe_id: z.preprocess(blank, z.uuid().nullable()).optional(),
    title: z.preprocess(blank, z.string().trim().max(150).nullable()).optional(),
    servings: z.coerce.number().int().min(1).max(20).default(2),
    notes: z.preprocess(blank, z.string().trim().max(300).nullable()).optional(),
    for_user: z.preprocess(blank, z.uuid().nullable()).optional(),
    portions: z.record(z.string(), z.number().min(0.25).max(4)).optional(),
    kcal_per_serving: z.number().int().min(0).max(5000).nullable().optional(),
    protein_g: z.number().min(0).max(500).nullable().optional(),
    carbs_g: z.number().min(0).max(1000).nullable().optional(),
    fat_g: z.number().min(0).max(500).nullable().optional(),
    ingredients: z.array(z.object({ name: z.string().trim().min(1).max(80), quantity: z.string().trim().max(40).nullable(), category: z.enum(GROCERY_CATEGORIES) })).max(20).optional(),
  })
  .refine((e) => e.recipe_id || e.title, { message: "Pick a recipe or type a dish." });

function refresh() {
  refreshModule("/food/plan");
  refreshModule("/recipes/plan");
}

/** Saturday or Sunday (or any day): the plan week starts on the shopping day. */
export async function setShoppingDay(day: number): Promise<ActionResult> {
  const d = z.number().int().min(0).max(6).safeParse(day);
  if (!d.success) return { error: "Pick a day." };
  try {
    const session = await getSession();
    const { error } = await session.supabase.rpc("set_shopping_day", { p_household: session.household.id, p_day: d.data });
    if (error) return { error: "Couldn't save the shopping day. If you've just updated the app, run the latest database update in Supabase." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refresh();
  return { ok: true };
}

/** Adds one or more dishes to the plan. */
export async function addPlanEntries(entries: unknown): Promise<ActionResult> {
  const parsed = z.array(entrySchema).min(1).max(60).safeParse(entries);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nothing to plan." };
  try {
    const session = await getSession();
    const rows = parsed.data.map((e) => ({
      plan_date: e.plan_date,
      meal: e.meal,
      recipe_id: e.recipe_id ?? null,
      title: e.recipe_id ? null : e.title,
      servings: e.servings,
      notes: e.notes ?? null,
      household_id: session.household.id,
      created_by: session.userId,
      ...(e.for_user && session.members.some((m) => m.user_id === e.for_user) ? { for_user: e.for_user } : {}),
      ...(e.portions && Object.keys(e.portions).length ? { portions: Object.fromEntries(Object.entries(e.portions).filter(([id]) => session.members.some((m) => m.user_id === id))) } : {}),
      ...(e.kcal_per_serving != null ? { kcal_per_serving: e.kcal_per_serving, protein_g: e.protein_g ?? null, carbs_g: e.carbs_g ?? null, fat_g: e.fat_g ?? null } : {}),
      ...(e.ingredients?.length ? { ingredients: e.ingredients } : {}),
    }));
    let { error } = await session.supabase.from("meal_plan").insert(rows);
    if (isMissingColumn(error)) {
      // Database not updated yet: save the dishes without the per-person details.
      ({ error } = await session.supabase.from("meal_plan").insert(rows.map(({ plan_date, meal, recipe_id, title, servings, notes, household_id, created_by }) => ({ plan_date, meal, recipe_id, title, servings, notes, household_id, created_by }))));
    }
    if (error) return { error: dbErrorMessage(error, "Couldn't add to the plan.") };
    refresh();
    return { ok: true, message: rows.length === 1 ? "Planned." : `Planned ${rows.length} meals.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function removePlanEntry(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Not found." };
  const session = await getSession();
  const { error } = await session.supabase.from("meal_plan").delete().eq("id", id).eq("household_id", session.household.id);
  if (error) return { error: "Couldn't remove it." };
  refresh();
  return { ok: true };
}

/** Copies the previous week's plan into this week, skipping dishes already planned in the same slot. */
export async function copyPreviousWeek(weekStart: string): Promise<ActionResult> {
  if (!isoDate.safeParse(weekStart).success) return { error: "Invalid week." };
  try {
    const session = await getSession();
    const from = addDays(weekStart, -7);
    const [{ data: prev }, { data: cur }] = await Promise.all([
      session.supabase.from("meal_plan").select("*").eq("household_id", session.household.id).gte("plan_date", from).lte("plan_date", addDays(from, 6)),
      session.supabase.from("meal_plan").select("*").eq("household_id", session.household.id).gte("plan_date", weekStart).lte("plan_date", addDays(weekStart, 6)),
    ]);
    const have = new Set(((cur ?? []) as MealPlanEntry[]).map((e) => `${e.plan_date}|${e.meal}|${e.recipe_id ?? ""}|${(e.title ?? "").toLowerCase()}`));
    const rows = ((prev ?? []) as MealPlanEntry[])
      .map((e) => ({ ...e, plan_date: addDays(e.plan_date, 7) }))
      .filter((e) => !have.has(`${e.plan_date}|${e.meal}|${e.recipe_id ?? ""}|${(e.title ?? "").toLowerCase()}`))
      .map((e) => ({
        plan_date: e.plan_date,
        meal: e.meal,
        recipe_id: e.recipe_id,
        title: e.title,
        servings: e.servings,
        notes: e.notes,
        household_id: session.household.id,
        created_by: session.userId,
        // Per-person details (present once the database is updated).
        ...("portions" in e ? { for_user: e.for_user ?? null, portions: e.portions ?? {}, kcal_per_serving: e.kcal_per_serving ?? null, protein_g: e.protein_g ?? null, carbs_g: e.carbs_g ?? null, fat_g: e.fat_g ?? null, ingredients: e.ingredients ?? [] } : {}),
      }));
    if (!rows.length) return { ok: true, message: (prev ?? []).length ? "Everything from last week is already planned." : "Nothing was planned last week." };
    const { error } = await session.supabase.from("meal_plan").insert(rows);
    if (error) return { error: "Couldn't copy last week." };
    refresh();
    return { ok: true, message: `Copied ${rows.length} meal${rows.length === 1 ? "" : "s"} from last week.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Change who a dish is for and each person's servings. */
export async function setPlanPortions(id: string, input: unknown): Promise<ActionResult> {
  const parsed = z.object({ for_user: z.uuid().nullable(), portions: z.record(z.string(), z.number().min(0.25).max(4)) }).safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(id).success) return { error: "Check the portions." };
  try {
    const session = await getSession();
    const members = session.members.map((m) => m.user_id);
    const forUser = parsed.data.for_user && members.includes(parsed.data.for_user) ? parsed.data.for_user : null;
    const portions = Object.fromEntries(Object.entries(parsed.data.portions).filter(([k]) => members.includes(k)));
    const total = (forUser ? [forUser] : members).reduce((a, m) => a + (portions[m] ?? 1), 0);
    const { error } = await session.supabase
      .from("meal_plan")
      .update({ for_user: forUser, portions, servings: Math.min(20, Math.max(1, Math.ceil(total))) })
      .eq("id", id)
      .eq("household_id", session.household.id);
    if (error) return { error: dbErrorMessage(error, "Couldn't save the portions.") };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refresh();
  return { ok: true, message: "Saved." };
}

/**
 * "We ate this": logs the planned dish to each eater's food diary with their
 * own portion (recipe nutrition when it's a saved recipe, else the plan's
 * per-serving estimate), at the meal's usual time on that day.
 */
export async function logPlannedMeal(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Not found." };
  try {
    const session = await getSession();
    const { data } = await session.supabase.from("meal_plan").select("*").eq("id", id).eq("household_id", session.household.id).maybeSingle();
    const e = data as MealPlanEntry | null;
    if (!e) return { error: "Not found." };
    const eaters = planFor(e, session.members.map((m) => m.user_id)).filter((m) => session.isModuleEnabled("food_diary") && session.accessTo("food_diary", m) === "write");
    if (!eaters.length) return { error: "You can't add to their food diary (check Settings → Sharing)." };
    const eatenAt = mealTimeOn(e.plan_date, e.meal, session.profile.timezone);
    let r: ActionResult;
    if (e.recipe_id) {
      r = await logRecipeForPeople(e.recipe_id, eaters.map((m) => ({ ownerId: m, servings: portionFor(e, m) })), e.meal, eatenAt);
    } else {
      if (e.kcal_per_serving == null) return { error: "No nutrition for this dish yet. Log it from the diary instead, or make it a recipe." };
      r = await logFoodForPeople(
        eaters.map((m) => ({ ownerId: m, factor: portionFor(e, m) })),
        e.meal,
        [{ description: e.title ?? "Planned meal", quantity: "1 serving", grams: null, nutrients: { calories: e.kcal_per_serving, protein_g: Number(e.protein_g ?? 0), carbs_g: Number(e.carbs_g ?? 0), fat_g: Number(e.fat_g ?? 0) }, accuracy: "estimated", irritants: [], source: "ai_estimate" }],
        eatenAt,
      );
    }
    if (r.error) return r;
    await session.supabase.from("meal_plan").update({ logged_at: new Date().toISOString() }).eq("id", id);
    refresh();
    refreshModule("/food");
    return { ok: true, message: `Logged for ${eaters.length === 1 ? (session.members.find((m) => m.user_id === eaters[0])?.display_name ?? "1 person") : `${eaters.length} people`}.` };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/** Links a newly made recipe to every planned dish with the same title this week. */
export async function linkPlanRecipe(title: string, recipeId: string, weekStart: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(recipeId).success || !isoDate.safeParse(weekStart).success) return { error: "Not found." };
  const session = await getSession();
  const { error } = await session.supabase
    .from("meal_plan")
    .update({ recipe_id: recipeId, title: null })
    .eq("household_id", session.household.id)
    .ilike("title", title.trim())
    .gte("plan_date", weekStart)
    .lte("plan_date", addDays(weekStart, 6));
  if (error) return { error: dbErrorMessage(error, "Couldn't link the recipe.") };
  refresh();
  refreshModule("/recipes");
  return { ok: true, message: "Recipe saved and linked to the plan." };
}

/** Rename a planned dish, or move it to another day or meal. */
export async function updatePlanEntry(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = z
    .object({ title: z.string().trim().min(1, "Name the dish").max(150).optional(), plan_date: isoDate, meal: z.enum(MEALS) })
    .safeParse({ ...input, title: input.title == null || input.title === "" ? undefined : input.title });
  if (!parsed.success || !z.uuid().safeParse(id).success) return { error: parsed.error?.issues[0]?.message ?? "Not found." };
  const session = await getSession();
  const { data, error } = await session.supabase.from("meal_plan").update(parsed.data).eq("id", id).eq("household_id", session.household.id).select("id");
  if (error || !data?.length) return { error: "Couldn't save the changes." };
  refresh();
  return { ok: true, message: "Saved." };
}
