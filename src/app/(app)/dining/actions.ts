"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { todayIn } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";

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
    if (error) return { error: "Couldn't add the dish." };
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
