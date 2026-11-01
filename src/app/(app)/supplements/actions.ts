"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { SUPPLEMENT_TIMINGS, type ActionResult } from "@/lib/types";
import { NUTRIENT_KEYS } from "@/modules/nutrition/nutrients";
import { confidentCatalogMatch } from "@/modules/nutrition/supplements";

const MODULE = "supplements";

const supplementSchema = z.object({
  ownerId: z.uuid(),
  name: z.string().trim().min(1, "Add a name").max(120),
  dose: z.string().trim().max(60).transform((v) => v || null),
  timing: z.enum(SUPPLEMENT_TIMINGS),
  stock_count: z
    .string()
    .transform((v) => (v.trim() === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 100000), "Stock must be a whole number"),
});

export async function addSupplement(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = supplementSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { count } = await session.supabase.from("supplements").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
    // A clear match with a common product fills in its nutrients (editable later).
    const match = confidentCatalogMatch(values.name);
    const { error } = await session.supabase.from("supplements").insert({
      ...values,
      owner_id: ownerId,
      created_by: session.userId,
      household_id: session.household.id,
      sort: count ?? 0,
      ...(match ? { nutrients: match.nutrients, serving_label: match.serving, nutrients_source: "catalog" } : {}),
    });
    if (error) return { error: "Couldn't add it." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/supplements");
  return { ok: true, message: "Added to your stack." };
}

/** Tick or untick a supplement for a day; adjusts stock if tracked. */
export async function toggleSupplement(supplementId: string, ownerId: string, date: string, taken: boolean): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date" };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data: sup } = await session.supabase.from("supplements").select("stock_count").eq("id", supplementId).single();
    if (taken) {
      const { error } = await session.supabase
        .from("supplement_logs")
        .upsert({ supplement_id: supplementId, owner_id: ownerId, log_date: date }, { onConflict: "supplement_id,log_date", ignoreDuplicates: true });
      if (error) return { error: "Couldn't save." };
      if (sup?.stock_count != null) {
        await session.supabase.from("supplements").update({ stock_count: Math.max(0, sup.stock_count - 1) }).eq("id", supplementId);
      }
    } else {
      const { data: removed } = await session.supabase
        .from("supplement_logs")
        .delete()
        .eq("supplement_id", supplementId)
        .eq("log_date", date)
        .select("supplement_id");
      if (removed?.length && sup?.stock_count != null) {
        await session.supabase.from("supplements").update({ stock_count: sup.stock_count + 1 }).eq("id", supplementId);
      }
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/supplements");
  return { ok: true };
}

export async function setSupplementActive(id: string, ownerId: string, active: boolean) {
  const session = await requireWrite(MODULE, ownerId);
  await session.supabase.from("supplements").update({ active }).eq("id", id);
  refreshModule("/supplements");
}

export async function setSupplementAi(id: string, ownerId: string, include: boolean) {
  const session = await requireWrite(MODULE, ownerId);
  await session.supabase.from("supplements").update({ include_in_ai: include }).eq("id", id);
  refreshModule("/supplements");
}

export async function deleteSupplement(id: string) {
  const session = await getSession();
  await session.supabase.from("supplements").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/supplements");
}

const nutrientsSchema = z
  .record(z.string(), z.number().min(0).max(100000))
  .transform((n) => Object.fromEntries(Object.entries(n).filter(([k, v]) => (NUTRIENT_KEYS as readonly string[]).includes(k) && v > 0)));

/** Saves what one dose contains (counted on days it's ticked). */
export async function saveSupplementNutrients(id: string, ownerId: string, input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ nutrients: nutrientsSchema, serving_label: z.string().trim().max(40).nullable(), source: z.enum(["manual", "label", "catalog"]) })
    .safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(id).success) return { error: "Check the amounts." };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase
      .from("supplements")
      .update({ nutrients: parsed.data.nutrients, serving_label: parsed.data.serving_label, nutrients_source: parsed.data.source })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) return { error: "Couldn't save. If you set up Hearth earlier, run update-existing-database.sql in Supabase first." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/supplements");
  refreshModule("/food");
  return { ok: true, message: "Saved." };
}
