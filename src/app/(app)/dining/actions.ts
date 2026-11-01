"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { todayIn } from "@/lib/dates";
import { menuItemSchema, MEALS } from "@/lib/ai/phase2-schemas";
import { getSession } from "@/lib/session";
import { addFoodItems } from "@/app/(app)/food/actions";
import { scaleDish } from "@/modules/dining/menu";
import type { ActionResult, DiningDish } from "@/lib/types";

const blank = (v: unknown) => (v === "" || v == null ? null : v);

const placeSchema = z.object({
  name: z.string().trim().min(1, "Name the place").max(120),
  cuisine: z.preprocess(blank, z.string().trim().max(60).nullable()),
  area: z.preprocess(blank, z.string().trim().max(80).nullable()),
  mode: z.enum(["delivery", "dine_in", "both"]),
  order_via: z.preprocess(blank, z.string().trim().max(40).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

export async function addPlace(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = placeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireModule("dining");
    const { error } = await session.supabase.from("dining_places").insert({ ...parsed.data, household_id: session.household.id, created_by: session.userId });
    if (error) return { error: "Couldn't add." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/dining");
  return { ok: true, message: "Place added." };
}

const dishSchema = z.object({
  placeId: z.uuid(),
  name: z.string().trim().min(1, "Dish name?").max(120),
  price: z.preprocess(blank, z.coerce.number().min(0).max(100000).nullable()),
  veg: z.preprocess((v) => (v === "veg" ? true : v === "nonveg" ? false : null), z.boolean().nullable()),
  calories: z.preprocess(blank, z.coerce.number().int().min(0).max(5000).nullable()),
  protein_g: z.preprocess(blank, z.coerce.number().min(0).max(500).nullable()),
  go_to_for: z.array(z.uuid()).max(10),
  notes: z.preprocess(blank, z.string().trim().max(300).nullable()),
});

export async function addDish(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = dishSchema.safeParse({ ...Object.fromEntries(form), go_to_for: form.getAll("go_to_for").map(String) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { placeId, ...values } = parsed.data;
  try {
    const session = await requireModule("dining");
    const members = new Set(session.members.map((m) => m.user_id));
    const { error } = await session.supabase
      .from("dining_dishes")
      .insert({ ...values, go_to_for: values.go_to_for.filter((id) => members.has(id)), place_id: placeId, household_id: session.household.id });
    if (error) return { error: error.code === "23505" ? "That dish is already on this menu." : "Couldn't add the dish." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/dining");
  return { ok: true, message: "Dish added." };
}

const orderSchema = z.object({
  place_id: z.preprocess(blank, z.uuid().nullable()),
  items: z.string().trim().min(1, "What did you order?").max(500),
  total: z.preprocess(blank, z.coerce.number().min(0).max(1_000_000).nullable()),
  rating: z.preprocess(blank, z.coerce.number().int().min(1).max(5).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(300).nullable()),
});

export async function logOrder(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = orderSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireModule("dining");
    const { error } = await session.supabase
      .from("dining_orders")
      .insert({ ...parsed.data, ordered_on: todayIn(session.profile.timezone), household_id: session.household.id, ordered_by: session.userId });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/dining");
  return { ok: true, message: "Order saved." };
}

export async function toggleFavoritePlace(id: string, favorite: boolean) {
  const session = await requireModule("dining");
  await session.supabase.from("dining_places").update({ favorite }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/dining");
}

export async function deletePlace(id: string) {
  const session = await requireModule("dining");
  await session.supabase.from("dining_places").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/dining");
}

export async function deleteDish(id: string) {
  const session = await requireModule("dining");
  await session.supabase.from("dining_dishes").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/dining");
}

/**
 * Saves dishes extracted from menu screenshots/text. Dishes already on the
 * menu (same name, any case) are updated in place, keeping "go-to" marks and
 * notes; new ones are added.
 */
export async function importMenu(placeId: string, items: unknown): Promise<ActionResult> {
  const parsed = z.array(menuItemSchema).min(1).max(250).safeParse(items);
  if (!z.uuid().safeParse(placeId).success || !parsed.success) return { error: "Some dishes are invalid." };
  try {
    const session = await requireModule("dining");
    const { data: place } = await session.supabase.from("dining_places").select("id").eq("id", placeId).eq("household_id", session.household.id).maybeSingle();
    if (!place) return { error: "Restaurant not found." };
    const { data: existing } = await session.supabase.from("dining_dishes").select("id, name").eq("place_id", placeId);
    const idByName = new Map((existing ?? []).map((d: { id: string; name: string }) => [d.name.trim().toLowerCase(), d.id]));

    const seen = new Set<string>();
    const rows = parsed.data
      .filter((d) => {
        const k = d.name.trim().toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((d) => ({
        id: idByName.get(d.name.trim().toLowerCase()) ?? crypto.randomUUID(),
        place_id: placeId,
        household_id: session.household.id,
        name: d.name.trim(),
        section: d.section,
        description: d.description,
        price: d.price,
        veg: d.veg,
        calories: d.calories,
        protein_g: d.protein_g,
        carbs_g: d.carbs_g,
        fat_g: d.fat_g,
        nutrition_estimated: true,
        source: "menu_import",
      }));
    const updated = rows.filter((r) => idByName.has(r.name.toLowerCase())).length;
    const { error } = await session.supabase.from("dining_dishes").upsert(rows, { onConflict: "id" });
    if (error) return { error: "Couldn't save the menu." };
    refreshModule("/dining");
    return { ok: true, message: `Saved ${rows.length - updated} new dish${rows.length - updated === 1 ? "" : "es"}${updated ? ` and updated ${updated}` : ""}.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Logs a saved restaurant dish to someone's food diary with a portion factor. */
export async function logDish(dishId: string, ownerId: string, meal: (typeof MEALS)[number], factor: number, eatenAt?: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(dishId).success || !(factor > 0 && factor <= 5)) return { error: "Invalid portion." };
  const session = await getSession();
  const { data } = await session.supabase
    .from("dining_dishes")
    .select("id, name, calories, protein_g, carbs_g, fat_g, place_id, dining_places(name)")
    .eq("id", dishId)
    .eq("household_id", session.household.id)
    .maybeSingle();
  if (!data) return { error: "Dish not found." };
  const dish = data as unknown as Pick<DiningDish, "id" | "name" | "calories" | "protein_g" | "carbs_g" | "fat_g"> & { dining_places: { name: string } | null };
  const res = await addFoodItems(ownerId, meal, [scaleDish(dish, factor, dish.dining_places?.name)], "restaurant", eatenAt, null, dish.id);
  if (res.ok) refreshModule("/dining");
  return res.ok ? { ok: true, message: `Logged ${dish.name}${dish.calories ? ` (~${Math.round(Number(dish.calories) * factor)} kcal)` : ""}.` } : res;
}

export async function updateDishNutrition(dishId: string, form: FormData) {
  const n = (k: string, max: number) => z.preprocess(blank, z.coerce.number().min(0).max(max).nullable()).catch(null).parse(form.get(k));
  const session = await requireModule("dining");
  await session.supabase
    .from("dining_dishes")
    .update({ calories: n("calories", 5000), protein_g: n("protein_g", 500), carbs_g: n("carbs_g", 1000), fat_g: n("fat_g", 500), price: n("price", 100000), nutrition_estimated: false })
    .eq("id", dishId)
    .eq("household_id", session.household.id);
  refreshModule("/dining");
}

export async function clearMenu(placeId: string) {
  const session = await requireModule("dining");
  await session.supabase.from("dining_dishes").delete().eq("place_id", placeId).eq("household_id", session.household.id).eq("source", "menu_import");
  refreshModule("/dining");
}

/** Creates a place with just a name (used when importing a shared menu). */
export async function createPlaceQuick(name: string): Promise<ActionResult & { id?: string }> {
  const parsed = z.string().trim().min(1).max(120).safeParse(name);
  if (!parsed.success) return { error: "Name the restaurant." };
  try {
    const session = await requireModule("dining");
    const { data, error } = await session.supabase.from("dining_places").insert({ name: parsed.data, household_id: session.household.id, created_by: session.userId }).select("id").single();
    if (error || !data) return { error: "Couldn't add the place." };
    refreshModule("/dining");
    return { ok: true, id: data.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
