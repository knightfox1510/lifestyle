"use server";

import { z } from "zod";
import { dbErrorMessage, errorMessage, isMissingColumn, refreshModule, requireWrite } from "@/lib/guards";
import { todayIn, zonedIso } from "@/lib/dates";
import { MEDICINE_FORMS, type ActionResult } from "@/lib/types";
import { SUPPLEMENT_KEYS } from "@/modules/nutrition/supplements";

const NUTRIENT_KEYS_FOR_MEDS = SUPPLEMENT_KEYS as [string, ...string[]];

const MODULE = "medicines";
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());
const optNum = z.preprocess(blankToNull, z.coerce.number().min(0).max(100000).nullable());
const optDate = z.preprocess(blankToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

const medicineSchema = z
  .object({
    id: z.preprocess(blankToNull, z.uuid().nullable()),
    ownerId: z.uuid(),
    name: z.string().trim().min(1, "Add the medicine name").max(120),
    strength: optText(60),
    form: z.enum(MEDICINE_FORMS),
    dose_amount: z.coerce.number().positive("Dose must be more than 0").max(1000),
    dose_unit: z.string().trim().min(1).max(20),
    instructions: optText(300),
    times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times must be HH:MM")).max(8),
    days_of_week: z.array(z.coerce.number().int().min(0).max(6)).max(7),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    end_date: optDate,
    stock_count: optNum,
    refill_threshold: optNum,
    reason: optText(200),
    prescribed_by: optText(120),
    include_in_ai: z.boolean(),
    add_to_timeline: z.boolean(),
    ingredients: optText(400),
    nutrients: z.preprocess(
      (v) => {
        if (typeof v !== "string" || !v.trim()) return {};
        try {
          return JSON.parse(v);
        } catch {
          return {};
        }
      },
      z.partialRecord(z.enum(NUTRIENT_KEYS_FOR_MEDS), z.number().min(0).max(100000)),
    ),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { message: "End date is before start date" });

export async function saveMedicine(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = medicineSchema.safeParse({
    ...Object.fromEntries(form),
    times: form.getAll("times").map(String).filter(Boolean),
    days_of_week: form.getAll("days_of_week").map(String),
    include_in_ai: form.get("include_in_ai") === "on",
    add_to_timeline: form.get("add_to_timeline") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ownerId, add_to_timeline, days_of_week, ...values } = parsed.data;
  const row = {
    ...values,
    times: [...new Set(values.times)].sort(),
    days_of_week: days_of_week.length === 0 || days_of_week.length === 7 ? null : [...new Set(days_of_week)].sort(),
  };

  // Databases without the composition/nutrients columns yet still save the rest.
  const { ingredients, nutrients, ...basic } = row;
  let note = "";
  try {
    const session = await requireWrite(MODULE, ownerId);
    if (id) {
      let { error } = await session.supabase.from("medicines").update(row).eq("id", id).eq("owner_id", ownerId);
      if (isMissingColumn(error)) {
        ({ error } = await session.supabase.from("medicines").update(basic).eq("id", id).eq("owner_id", ownerId));
        if (!error && (ingredients || Object.keys(nutrients).length)) note = " Composition and nutrients weren't saved: run the latest database update in Supabase.";
      }
      if (error) {
        console.error("save medicine failed", error.code, error.message);
        return { error: dbErrorMessage(error, "Couldn't save the medicine.") };
      }
    } else {
      const meta = { owner_id: ownerId, created_by: session.userId, household_id: session.household.id };
      let { error } = await session.supabase.from("medicines").insert({ ...row, ...meta });
      if (isMissingColumn(error)) {
        ({ error } = await session.supabase.from("medicines").insert({ ...basic, ...meta }));
        if (!error && (ingredients || Object.keys(nutrients).length)) note = " Composition and nutrients weren't saved: run the latest database update in Supabase.";
      }
      if (error) {
        console.error("add medicine failed", error.code, error.message);
        return { error: dbErrorMessage(error, "Couldn't add the medicine.") };
      }

      // Mirror into the medical timeline so history (and AI) sees it.
      if (add_to_timeline && session.isModuleEnabled("medical_records") && session.accessTo("medical_records", ownerId) === "write") {
        await session.supabase.from("medical_events").insert({
          owner_id: ownerId,
          created_by: session.userId,
          household_id: session.household.id,
          category: "medication",
          title: [values.name, values.strength].filter(Boolean).join(" "),
          details: [values.reason && `For: ${values.reason}`, values.prescribed_by && `Prescribed by ${values.prescribed_by}`, values.instructions]
            .filter(Boolean)
            .join(". ") || null,
          start_date: values.start_date,
          end_date: values.end_date,
          ongoing: !values.end_date,
          dosage: `${values.dose_amount} ${values.dose_unit}`,
          frequency: row.times.length ? `${row.times.length}× daily (${row.times.join(", ")})` : "as needed",
          include_in_ai: values.include_in_ai,
        });
      }
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/medicines");
  return { ok: true, message: (id ? "Saved." : "Medicine added.") + note };
}

export async function setMedicineActive(id: string, ownerId: string, active: boolean) {
  const session = await requireWrite(MODULE, ownerId);
  const today = todayIn(session.profile.timezone);
  await session.supabase
    .from("medicines")
    .update(active ? { active, end_date: null } : { active, end_date: today })
    .eq("id", id);
  refreshModule("/medicines");
}

/**
 * Removes a medicine added by mistake, with its dose history. The owner can
 * always; a partner with write access can remove ones they added.
 */
export async function deleteMedicine(id: string, ownerId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Not found." };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data, error } = await session.supabase.from("medicines").delete().eq("id", id).eq("owner_id", ownerId).select("id");
    if (error || !data?.length) {
      return { error: ownerId === session.userId ? "Couldn't delete the medicine." : "Only the person it belongs to, or whoever added it, can delete it. Stop it instead." };
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/medicines");
  return { ok: true, message: "Medicine deleted." };
}

export async function restockMedicine(id: string, ownerId: string, form: FormData) {
  const amount = z.coerce.number().positive().max(10000).safeParse(form.get("amount"));
  if (!amount.success) return;
  const session = await requireWrite(MODULE, ownerId);
  const { data } = await session.supabase.from("medicines").select("stock_count").eq("id", id).single();
  await session.supabase
    .from("medicines")
    .update({ stock_count: Number(data?.stock_count ?? 0) + amount.data })
    .eq("id", id);
  refreshModule("/medicines");
}

/**
 * Mark a scheduled slot (or an as-needed dose when time is null) taken or
 * skipped, today or on an earlier day. Past doses are timed at their slot
 * (as-needed ones at noon), and logging a day before the medicine's start
 * date moves the start date back to it.
 */
export async function logDose(
  medicineId: string,
  ownerId: string,
  date: string,
  time: string | null,
  status: "taken" | "skipped",
): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (time !== null && !/^\d{2}:\d{2}$/.test(time))) return { error: "Invalid slot" };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const tz = session.profile.timezone;
    const today = todayIn(tz);
    if (date > today) return { error: "You can't log a dose for a future day." };
    const takenAt = date < today ? zonedIso(date, time ?? "12:00", tz) : new Date().toISOString();
    if (date < today) {
      const { data: med } = await session.supabase.from("medicines").select("start_date").eq("id", medicineId).maybeSingle();
      if (med && date < med.start_date && med.start_date <= today) await session.supabase.from("medicines").update({ start_date: date }).eq("id", medicineId);
    }
    if (time) {
      const { data: existing } = await session.supabase
        .from("medicine_doses")
        .select("id")
        .eq("medicine_id", medicineId)
        .eq("scheduled_date", date)
        .eq("scheduled_time", time)
        .maybeSingle();
      if (existing) {
        await session.supabase.from("medicine_doses").update({ status, taken_at: takenAt }).eq("id", existing.id);
        refreshModule("/medicines");
        return { ok: true, id: existing.id };
      }
    }
    const { data: row, error } = await session.supabase.from("medicine_doses").insert({
      medicine_id: medicineId,
      owner_id: ownerId,
      scheduled_date: date,
      scheduled_time: time,
      status,
      taken_at: takenAt,
      logged_by: session.userId,
    }).select("id").single();
    if (error) return { error: "Couldn't log the dose." };
    refreshModule("/medicines");
    return { ok: true, id: row?.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function undoDose(doseId: string, ownerId: string) {
  const session = await requireWrite(MODULE, ownerId);
  await session.supabase.from("medicine_doses").delete().eq("id", doseId);
  refreshModule("/medicines");
}
