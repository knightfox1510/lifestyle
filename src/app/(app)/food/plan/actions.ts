"use server";

import { z } from "zod";
import { errorMessage, refreshModule } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { addDays } from "@/lib/dates";
import { MEALS } from "@/lib/ai/phase2-schemas";
import type { ActionResult, MealPlanEntry } from "@/lib/types";

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
    }));
    const { error } = await session.supabase.from("meal_plan").insert(rows);
    if (error) return { error: "Couldn't add to the plan." };
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
      .map((e) => ({ plan_date: e.plan_date, meal: e.meal, recipe_id: e.recipe_id, title: e.title, servings: e.servings, notes: e.notes, household_id: session.household.id, created_by: session.userId }));
    if (!rows.length) return { ok: true, message: (prev ?? []).length ? "Everything from last week is already planned." : "Nothing was planned last week." };
    const { error } = await session.supabase.from("meal_plan").insert(rows);
    if (error) return { error: "Couldn't copy last week." };
    refresh();
    return { ok: true, message: `Copied ${rows.length} meal${rows.length === 1 ? "" : "s"} from last week.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
