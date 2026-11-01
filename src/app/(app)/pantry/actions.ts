"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { addDays, todayIn } from "@/lib/dates";
import { scanItemSchema } from "@/lib/ai/phase2-schemas";
import { GROCERY_CATEGORIES, type ActionResult, type Meal } from "@/lib/types";
import { guessCategory } from "@/modules/groceries/meta";
import { matchPantry, namesMatch, restockDefaults } from "@/modules/pantry/match";
import { getSession } from "@/lib/session";
import { logRecipeForPeople } from "@/app/(app)/recipes/actions";

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

type Session = Awaited<ReturnType<typeof requireModule>>;
type Reason = "used_up" | "running_low" | "staple";

/** Adds a pantry item to the grocery list unless an open entry with the same name is already there. */
async function addToGroceries(session: Session, item: { id: string; name: string; quantity: string | null; category: string }, reason: Reason) {
  if (!session.isModuleEnabled("groceries")) return false;
  const { data: open } = await session.supabase
    .from("grocery_items")
    .select("id, name")
    .eq("household_id", session.household.id)
    .eq("checked", false)
    .is("deleted_at", null);
  if ((open ?? []).some((g: { name: string }) => namesMatch(g.name, item.name))) return false;
  await session.supabase.from("grocery_items").insert({
    id: crypto.randomUUID(),
    household_id: session.household.id,
    created_by: session.userId,
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    reason,
    pantry_item_id: item.id,
  });
  refreshModule("/groceries");
  return true;
}

/** Used up. Staples always go back on the grocery list; others only when `rebuy`. */
export async function markUsedUp(id: string, rebuy: boolean): Promise<ActionResult> {
  const session = await requireModule("pantry");
  const { data } = await session.supabase
    .from("pantry_items")
    .update({ used_up_at: new Date().toISOString(), running_low: false })
    .eq("id", id)
    .eq("household_id", session.household.id)
    .select("id, name, quantity, category, staple")
    .single();
  if (!data) return { error: "Item not found." };
  const listed = rebuy || data.staple ? await addToGroceries(session, data, data.staple ? "staple" : "used_up") : false;
  refreshModule("/pantry");
  return { ok: true, message: listed ? `${data.name}: used up, added to the grocery list.` : `${data.name}: used up.` };
}

/** Still some left, but time to buy more: stays in the pantry and goes on the list. */
export async function setRunningLow(id: string): Promise<ActionResult> {
  const session = await requireModule("pantry");
  const { data } = await session.supabase
    .from("pantry_items")
    .update({ running_low: true })
    .eq("id", id)
    .eq("household_id", session.household.id)
    .select("id, name, quantity, category, staple")
    .single();
  if (!data) return { error: "Item not found." };
  const listed = await addToGroceries(session, data, data.staple ? "staple" : "running_low");
  refreshModule("/pantry");
  return { ok: true, message: listed ? `${data.name}: running low, added to the grocery list.` : `${data.name}: running low (already on the list).` };
}

/** Staples (atta, milk, eggs…) are always re-added to the list when they run out. */
export async function setStaple(id: string, on: boolean) {
  const session = await requireModule("pantry");
  await session.supabase.from("pantry_items").update({ staple: on }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/pantry");
}

/** Open pantry items that match these ingredient or food names (for "used any of these?"). */
export async function pantryMatches(names: string[]): Promise<{ id: string; name: string; staple: boolean }[]> {
  const list = z.array(z.string().max(200)).max(80).safeParse(names);
  if (!list.success || !list.data.length) return [];
  const session = await getSession();
  if (!session.isModuleEnabled("pantry")) return [];
  const { data } = await session.supabase
    .from("pantry_items")
    .select("id, name, used_up_at, staple, recipe_id")
    .eq("household_id", session.household.id)
    .is("used_up_at", null)
    .is("recipe_id", null)
    .limit(500);
  return matchPantry(list.data, (data ?? []) as { id: string; name: string; used_up_at: string | null; staple: boolean }[])
    .slice(0, 12)
    .map((p) => ({ id: p.id, name: p.name, staple: p.staple }));
}

/**
 * Bought: checked grocery items go into the pantry. Items that came from the
 * pantry (ran out / running low) reopen that same item; others are created
 * with a typical place and shelf life.
 */
export async function restockFromGroceries(groceryIds: string[]): Promise<ActionResult> {
  const ids = z.array(z.uuid()).max(200).safeParse(groceryIds);
  if (!ids.success || !ids.data.length) return { error: "Nothing to put away." };
  const session = await requireModule("pantry");
  const today = todayIn(session.profile.timezone);
  const { data: rows } = await session.supabase
    .from("grocery_items")
    .select("id, name, quantity, category, pantry_item_id")
    .eq("household_id", session.household.id)
    .in("id", ids.data);
  let added = 0;
  for (const g of (rows ?? []) as { id: string; name: string; quantity: string | null; category: string; pantry_item_id: string | null }[]) {
    const d = restockDefaults(g.category);
    const expires = d.days === null ? null : addDays(today, d.days);
    if (g.pantry_item_id) {
      const { data: reopened } = await session.supabase
        .from("pantry_items")
        .update({ used_up_at: null, running_low: false, purchased_on: today, expires_on: expires, expiry_estimated: d.days !== null, opened: false, quantity: g.quantity })
        .eq("id", g.pantry_item_id)
        .eq("household_id", session.household.id)
        .select("id")
        .maybeSingle();
      if (reopened) {
        added += 1;
        continue;
      }
    }
    const { error } = await session.supabase.from("pantry_items").insert({
      household_id: session.household.id,
      created_by: session.userId,
      name: g.name,
      quantity: g.quantity,
      category: g.category,
      location: d.location,
      purchased_on: today,
      expires_on: expires,
      expiry_estimated: d.days !== null,
    });
    if (!error) added += 1;
  }
  // Clear them from the list (soft delete, like "Clear checked").
  await session.supabase.from("grocery_items").update({ deleted_at: new Date().toISOString() }).eq("household_id", session.household.id).in("id", ids.data);
  refreshModule("/pantry");
  refreshModule("/groceries");
  return { ok: true, message: `${added} item${added === 1 ? "" : "s"} put in the pantry.` };
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

/** Eat portions of a leftover: logs them from its recipe and counts down; used up at 0. */
export async function eatLeftover(pantryId: string, people: { ownerId: string; servings: number }[], meal: Meal): Promise<ActionResult> {
  const session = await requireModule("pantry");
  const { data: item } = await session.supabase.from("pantry_items").select("id, recipe_id, portions, name").eq("id", pantryId).eq("household_id", session.household.id).maybeSingle();
  if (!item?.recipe_id) return { error: "This leftover isn't linked to a recipe." };
  const eaten = people.reduce((a, p) => a + Math.max(0, p.servings), 0);
  if (eaten <= 0) return { error: "Choose how much was eaten." };
  const res = await logRecipeForPeople(item.recipe_id, people, meal);
  if (res.error) return res;
  const left = Math.max(0, Math.round((Number(item.portions ?? 0) - eaten) * 100) / 100);
  await session.supabase
    .from("pantry_items")
    .update(left > 0 ? { portions: left, quantity: `${left} portion${left === 1 ? "" : "s"}` } : { portions: 0, used_up_at: new Date().toISOString() })
    .eq("id", pantryId);
  refreshModule("/pantry");
  return { ok: true, message: `${res.message ?? "Logged."}${left > 0 ? ` ${left} left.` : " All gone."}` };
}
