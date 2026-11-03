"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { addDays, localInputToIso } from "@/lib/dates";
import { IAP_SCHEDULE } from "@/modules/child/vaccines";
import { CHILD_LOG_KINDS, type ActionResult } from "@/lib/types";

const blank = (v: unknown) => (v === "" || v == null ? null : v);

const depSchema = z.object({
  name: z.string().trim().min(1, "Name?").max(60),
  kind: z.enum(["child", "pet"]),
  date_of_birth: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  sex: z.preprocess(blank, z.enum(["female", "male", "other"]).nullable()),
  seed_vaccines: z.boolean(),
});

export async function addDependent(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = depSchema.safeParse({ ...Object.fromEntries(form), seed_vaccines: form.get("seed_vaccines") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { seed_vaccines, ...values } = parsed.data;
  try {
    const session = await requireModule("child");
    const { data, error } = await session.supabase
      .from("dependents")
      .insert({ ...values, household_id: session.household.id, created_by: session.userId })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't add." };
    if (seed_vaccines && values.kind === "child" && values.date_of_birth) {
      await session.supabase.from("vaccinations").insert(
        IAP_SCHEDULE.map((v) => ({ dependent_id: data.id, household_id: session.household.id, vaccine: v.vaccine, due_on: addDays(values.date_of_birth!, v.ageDays) })),
      );
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/child");
  return { ok: true, message: "Added." };
}

const logSchema = z.object({
  dependentId: z.uuid(),
  kind: z.enum(CHILD_LOG_KINDS),
  started_at: z.preprocess(blank, z.iso.datetime({ offset: true }).nullable()),
  amount_ml: z.preprocess(blank, z.coerce.number().int().min(0).max(2000).nullable()),
  value: z.preprocess(blank, z.coerce.number().min(25).max(45).nullable()),
  detail: z.preprocess(blank, z.string().trim().max(300).nullable()),
});

export async function logChild(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = logSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { dependentId, started_at, ...values } = parsed.data;
  if (values.kind === "medicine" && !values.detail) return { error: "Which medicine and how much?" };
  try {
    const session = await requireModule("child");
    const { error } = await session.supabase.from("child_logs").insert({
      ...values,
      dependent_id: dependentId,
      household_id: session.household.id,
      logged_by: session.userId,
      started_at: started_at ?? new Date().toISOString(),
    });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/child");
  return { ok: true, message: "Logged." };
}

export async function startSleep(dependentId: string) {
  const session = await requireModule("child");
  await session.supabase.from("child_logs").insert({ dependent_id: dependentId, household_id: session.household.id, logged_by: session.userId, kind: "sleep" });
  refreshModule("/child");
}

export async function endSleep(logId: string) {
  const session = await requireModule("child");
  await session.supabase.from("child_logs").update({ ended_at: new Date().toISOString() }).eq("id", logId).eq("household_id", session.household.id);
  refreshModule("/child");
}

export async function deleteChildLog(id: string) {
  const session = await requireModule("child");
  await session.supabase.from("child_logs").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/child");
}

export async function setVaccineGiven(id: string, given: boolean, form: FormData) {
  const session = await requireModule("child");
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(form.get("given_on"));
  await session.supabase
    .from("vaccinations")
    .update({ given_on: given ? (date.success ? date.data : new Date().toISOString().slice(0, 10)) : null })
    .eq("id", id)
    .eq("household_id", session.household.id);
  refreshModule("/child");
}

const vacSchema = z.object({
  dependentId: z.uuid(),
  vaccine: z.string().trim().min(1).max(120),
  due_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
});
export async function addVaccine(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = vacSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Name the vaccine." };
  const session = await requireModule("child");
  const { error } = await session.supabase.from("vaccinations").insert({ dependent_id: parsed.data.dependentId, household_id: session.household.id, vaccine: parsed.data.vaccine, due_on: parsed.data.due_on });
  if (error) return { error: "Couldn't add." };
  refreshModule("/child");
  return { ok: true, message: "Added." };
}

export async function deleteVaccine(id: string) {
  const session = await requireModule("child");
  await session.supabase.from("vaccinations").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/child");
}

const growthSchema = z.object({
  dependentId: z.uuid(),
  measured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight_kg: z.preprocess(blank, z.coerce.number().min(0.3).max(200).nullable()),
  height_cm: z.preprocess(blank, z.coerce.number().min(20).max(250).nullable()),
  head_cm: z.preprocess(blank, z.coerce.number().min(20).max(70).nullable()),
});
export async function addGrowth(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = growthSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the numbers." };
  const { dependentId, ...values } = parsed.data;
  if (values.weight_kg === null && values.height_cm === null && values.head_cm === null) return { error: "Enter at least one measurement." };
  const session = await requireModule("child");
  const { error } = await session.supabase.from("growth_records").insert({ ...values, dependent_id: dependentId, household_id: session.household.id });
  if (error) return { error: "Couldn't save." };
  refreshModule("/child");
  return { ok: true, message: "Saved." };
}

const asText = (input: Record<string, unknown>) => Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v == null ? "" : String(v)]));

/** Fix a feed / sleep / nappy / medicine / temperature entry: type, times and details. */
export async function updateChildLog(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = logSchema.omit({ dependentId: true, started_at: true }).safeParse(asText(input));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireModule("child");
    const tz = session.profile.timezone;
    const started = localInputToIso(input.started, tz);
    const ended = input.ended ? localInputToIso(input.ended, tz) : null;
    if (!started) return { error: "Pick a start time that isn't in the future." };
    if (ended && ended < started) return { error: "It ended before it started." };
    const { data, error } = await session.supabase
      .from("child_logs")
      .update({ ...parsed.data, started_at: started, ...(parsed.data.kind === "sleep" ? { ended_at: ended } : {}) })
      .eq("id", id)
      .eq("household_id", session.household.id)
      .select("id");
    if (error || !data?.length) return { error: "Couldn't save the changes." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/child");
  return { ok: true, message: "Saved." };
}

/** Fix a vaccination: its name, due date, or the date it was given. */
export async function updateVaccine(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = z
    .object({
      vaccine: z.string().trim().min(1).max(120),
      due_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
      given_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
    })
    .safeParse(asText(input));
  if (!parsed.success) return { error: "Check the vaccine details." };
  try {
    const session = await requireModule("child");
    const { data, error } = await session.supabase.from("vaccinations").update(parsed.data).eq("id", id).eq("household_id", session.household.id).select("id");
    if (error || !data?.length) return { error: "Couldn't save the changes." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/child");
  return { ok: true, message: "Saved." };
}

/** Fix a growth measurement. */
export async function updateGrowth(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = growthSchema.omit({ dependentId: true }).safeParse(asText(input));
  if (!parsed.success) return { error: "Check the numbers." };
  try {
    const session = await requireModule("child");
    const { data, error } = await session.supabase.from("growth_records").update(parsed.data).eq("id", id).eq("household_id", session.household.id).select("id");
    if (error || !data?.length) return { error: "Couldn't save the changes." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/child");
  return { ok: true, message: "Saved." };
}

export async function deleteGrowth(id: string) {
  const session = await requireModule("child");
  await session.supabase.from("growth_records").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/child");
}
