"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { addDays, todayIn } from "@/lib/dates";
import { scanItemSchema } from "@/lib/ai/phase2-schemas";
import { GROCERY_CATEGORIES, type ActionResult } from "@/lib/types";
import { guessCategory } from "@/modules/groceries/meta";

const blank = (v: unknown) => (v === "" || v == null ? null : v);

const itemSchema = z.object({
  name: z.string().trim().min(1, "Name the item").max(120),
  quantity: z.preprocess(blank, z.string().trim().max(40).nullable()),
  location: z.enum(["fridge", "freezer", "pantry"]),
  category: z.preprocess(blank, z.enum(GROCERY_CATEGORIES).nullable()),
  expires_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
});

export async function addPantryItem(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireModule("pantry");
    const { error } = await session.supabase.from("pantry_items").insert({
      ...parsed.data,
      category: parsed.data.category ?? guessCategory(parsed.data.name),
      purchased_on: todayIn(session.profile.timezone),
      household_id: session.household.id,
      created_by: session.userId,
    });
    if (error) return { error: "Couldn't add it." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/pantry");
  return { ok: true, message: "Added to pantry." };
}

/** Bulk add from a camera scan (after the user confirmed the list). */
export async function addScannedToPantry(items: unknown, fromReceipt: boolean): Promise<ActionResult> {
  const parsed = z.array(scanItemSchema).min(1).max(80).safeParse(items);
  if (!parsed.success) return { error: "Some items are invalid." };
  try {
    const session = await requireModule("pantry");
    const today = todayIn(session.profile.timezone);
    const { error } = await session.supabase.from("pantry_items").insert(
      parsed.data.map((i) => ({
        household_id: session.household.id,
        created_by: session.userId,
        name: i.name,
        quantity: i.quantity,
        category: i.category,
        location: i.location,
        purchased_on: fromReceipt ? today : null,
        expires_on: i.expires_in_days === null ? null : addDays(today, i.expires_in_days),
        expiry_estimated: !i.expiry_printed,
      })),
    );
    if (error) return { error: "Couldn't add the items." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/pantry");
  return { ok: true, message: `Added ${parsed.data.length} item${parsed.data.length === 1 ? "" : "s"} to the pantry.` };
}

export async function markUsedUp(id: string, rebuy: boolean): Promise<void> {
  {
    const session = await requireModule("pantry");
    const { data } = await session.supabase
      .from("pantry_items")
      .update({ used_up_at: new Date().toISOString() })
      .eq("id", id)
      .eq("household_id", session.household.id)
      .select("name, quantity, category")
      .single();
    if (rebuy && data && session.isModuleEnabled("groceries")) {
      await session.supabase.from("grocery_items").insert({
        id: crypto.randomUUID(),
        household_id: session.household.id,
        created_by: session.userId,
        name: data.name,
        quantity: data.quantity,
        category: data.category,
      });
      refreshModule("/groceries");
    }
  }
  refreshModule("/pantry");
}

export async function setOpened(id: string, opened: boolean) {
  const session = await requireModule("pantry");
  await session.supabase.from("pantry_items").update({ opened }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/pantry");
}

export async function setExpiry(id: string, form: FormData) {
  const date = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()).safeParse(form.get("expires_on"));
  if (!date.success) return;
  const session = await requireModule("pantry");
  await session.supabase.from("pantry_items").update({ expires_on: date.data, expiry_estimated: false }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/pantry");
}

export async function deletePantryItem(id: string) {
  const session = await requireModule("pantry");
  await session.supabase.from("pantry_items").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/pantry");
}
