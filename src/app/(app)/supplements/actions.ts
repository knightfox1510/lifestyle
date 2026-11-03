"use server";

import { z } from "zod";
import { dbErrorMessage, errorMessage, isMissingColumn, refreshModule, requireWrite } from "@/lib/guards";
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

const repeatSchema = z.object({
  days_of_week: z.array(z.coerce.number().int().min(0).max(6)).max(7),
  repeat_every_days: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(2).max(365).nullable()),
  schedule_start: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
});

/** Columns for how often: every N days wins; 0 or 7 weekdays = every day. */
function repeatRow(r: z.infer<typeof repeatSchema>) {
  const days = [...new Set(r.days_of_week)].sort();
  return {
    days_of_week: r.repeat_every_days || days.length === 0 || days.length === 7 ? null : days,
    repeat_every_days: r.repeat_every_days,
    ...(r.schedule_start ? { schedule_start: r.schedule_start } : {}),
  };
}

export async function addSupplement(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = supplementSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const rep = repeatSchema.safeParse({ days_of_week: form.getAll("days_of_week").map(String), repeat_every_days: form.get("repeat_every_days"), schedule_start: form.get("schedule_start") });
  const { ownerId, ...values } = parsed.data;
  const schedule = rep.success ? repeatRow(rep.data) : {};
  const hasSchedule = Boolean((schedule as { days_of_week?: unknown }).days_of_week || (schedule as { repeat_every_days?: unknown }).repeat_every_days);
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { count } = await session.supabase.from("supplements").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
    // A clear match with a common product fills in its nutrients (editable later).
    const match = confidentCatalogMatch(values.name);
    const row = {
      ...values,
      owner_id: ownerId,
      created_by: session.userId,
      household_id: session.household.id,
      sort: count ?? 0,
      ...(match ? { nutrients: match.nutrients, serving_label: match.serving, nutrients_source: "catalog" } : {}),
      // A weekly product from the catalog (e.g. D3 60K) defaults to once a week.
      ...(hasSchedule ? schedule : match?.weekly ? { repeat_every_days: 7 } : {}),
    };
    let { error } = await session.supabase.from("supplements").insert(row);
    if (isMissingColumn(error)) {
      const { days_of_week, repeat_every_days, schedule_start, ...basic } = row as typeof row & { days_of_week?: unknown; repeat_every_days?: unknown; schedule_start?: unknown };
      void days_of_week; void repeat_every_days; void schedule_start;
      ({ error } = await session.supabase.from("supplements").insert(basic));
    }
    if (error) return { error: dbErrorMessage(error, "Couldn't add it.") };
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

/** Fix a supplement's name, dose, when it's taken and stock. */
export async function updateSupplement(id: string, ownerId: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = supplementSchema.omit({ ownerId: true }).safeParse(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v == null ? "" : String(v)])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data, error } = await session.supabase.from("supplements").update(parsed.data).eq("id", id).eq("owner_id", ownerId).select("id");
    if (error || !data?.length) return { error: "Couldn't save the changes." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/supplements");
  return { ok: true, message: "Saved." };
}


/** How often a supplement is taken: every day, chosen weekdays, once a week, or every N days (from a start date). */
export async function setSupplementSchedule(id: string, ownerId: string, input: unknown): Promise<ActionResult> {
  const parsed = repeatSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the schedule." };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data, error } = await session.supabase.from("supplements").update(repeatRow(parsed.data)).eq("id", id).eq("owner_id", ownerId).select("id");
    if (error || !data?.length) return { error: dbErrorMessage(error, "Couldn't save the schedule.") };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/supplements");
  refreshModule("/medicines");
  return { ok: true, message: "Schedule saved." };
}
