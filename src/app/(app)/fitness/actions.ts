"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { WORKOUT_KINDS, type ActionResult } from "@/lib/types";
import { KIND_META } from "@/modules/fitness/meta";

const KIND_LABEL = Object.fromEntries(Object.entries(KIND_META).map(([k, v]) => [k, v.label])) as Record<string, string>;

const MODULE = "fitness";
const blank = (v: unknown) => (v === "" || v == null ? null : v);

const classSchema = z.object({
  ownerId: z.uuid(),
  id: z.preprocess(blank, z.uuid().nullable()),
  name: z.string().trim().min(1, "Name the class").max(100),
  kind: z.enum(WORKOUT_KINDS),
  days_of_week: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day").max(7),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a start time"),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  location: z.preprocess(blank, z.string().trim().max(120).nullable()),
  instructor: z.preprocess(blank, z.string().trim().max(120).nullable()),
  remind_minutes_before: z.preprocess(blank, z.coerce.number().int().min(0).max(1440).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

export async function saveClass(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = classSchema.safeParse({ ...Object.fromEntries(form), days_of_week: form.getAll("days_of_week").map(String) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, id, ...values } = parsed.data;
  const row = { ...values, days_of_week: [...new Set(values.days_of_week)].sort() };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = id
      ? await session.supabase.from("fitness_classes").update(row).eq("id", id)
      : await session.supabase.from("fitness_classes").insert({ ...row, owner_id: ownerId, household_id: session.household.id });
    if (error) return { error: "Couldn't save the class." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/fitness");
  return { ok: true, message: id ? "Saved." : "Class added to your schedule." };
}

export async function setClassActive(id: string, ownerId: string, active: boolean) {
  const session = await requireWrite(MODULE, ownerId);
  await session.supabase.from("fitness_classes").update({ active }).eq("id", id);
  refreshModule("/fitness");
}

export async function deleteClass(id: string) {
  const session = await getSession();
  await session.supabase.from("fitness_classes").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/fitness");
}

/** Marks a scheduled class as done/skipped for a day (toggle back with status null). */
export async function markClass(classId: string, ownerId: string, date: string, status: "done" | "skipped" | null): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date" };
  try {
    const session = await requireWrite(MODULE, ownerId);
    await session.supabase.from("workout_logs").delete().eq("class_id", classId).eq("performed_on", date);
    if (status) {
      const { data: c } = await session.supabase.from("fitness_classes").select("*").eq("id", classId).single();
      if (!c) return { error: "Class not found" };
      const { error } = await session.supabase.from("workout_logs").insert({
        owner_id: ownerId,
        household_id: session.household.id,
        performed_on: date,
        class_id: classId,
        kind: c.kind,
        title: c.name,
        status,
        duration_minutes: status === "done" ? c.duration_minutes : null,
      });
      if (error) return { error: "Couldn't save." };
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/fitness");
  return { ok: true };
}

const workoutSchema = z.object({
  ownerId: z.uuid(),
  performed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(WORKOUT_KINDS),
  title: z.string().trim().min(1, "What did you do?").max(100),
  duration_minutes: z.preprocess(blank, z.coerce.number().int().min(1).max(600).nullable()),
  intensity: z.preprocess(blank, z.coerce.number().int().min(1).max(5).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

export async function logWorkout(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = workoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase.from("workout_logs").insert({ ...values, status: "done", owner_id: ownerId, household_id: session.household.id });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/fitness");
  return { ok: true, message: "Workout logged. 💪" };
}

export async function deleteWorkout(id: string) {
  const session = await getSession();
  // A workout imported from Health Connect is remembered as deleted, so the next sync doesn't bring it back.
  const { data: row } = await session.supabase.from("workout_logs").select("external_id").eq("id", id).eq("owner_id", session.userId).maybeSingle();
  if (row?.external_id) await session.supabase.from("workout_dismissed").upsert({ owner_id: session.userId, external_id: row.external_id }, { onConflict: "owner_id,external_id" });
  await session.supabase.from("workout_logs").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/fitness");
}

/** Fix a logged workout: date, type, name, minutes, effort and notes. */
export async function updateWorkout(id: string, ownerId: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = workoutSchema.omit({ ownerId: true }).safeParse(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v == null ? "" : String(v)])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data, error } = await session.supabase.from("workout_logs").update(parsed.data).eq("id", id).eq("owner_id", ownerId).select("id");
    if (error || !data?.length) return { error: "Couldn't save the changes." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/fitness");
  return { ok: true, message: "Saved." };
}

const goalSchema = z.object({
  ownerId: z.uuid(),
  kind: z.enum(["any", ...WORKOUT_KINDS]),
  times_per_week: z.coerce.number().int().min(1, "At least once a week").max(14),
  min_minutes: z.preprocess(blank, z.coerce.number().int().min(1).max(600).nullable()),
});

/** "Gym 4 times a week": one goal per workout type; saving the same type again changes it. */
export async function saveGoal(input: { ownerId: string; kind: string; times_per_week: number | string; min_minutes?: number | string | null }): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase
      .from("fitness_goals")
      .upsert({ ...values, active: true, owner_id: ownerId, household_id: session.household.id }, { onConflict: "owner_id,kind" });
    if (error) return { error: error.code === "42P01" ? "Run the latest database update in Supabase first." : "Couldn't save the goal." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/fitness");
  return { ok: true, message: "Weekly goal saved." };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const session = await getSession();
  const { error } = await session.supabase.from("fitness_goals").delete().eq("id", id).eq("owner_id", session.userId);
  if (error) return { error: "Couldn't remove the goal." };
  refreshModule("/fitness");
  return { ok: true, message: "Goal removed." };
}

/** One tap from a goal: "Gym today" logs a done session of that type (with the goal's minimum minutes, if it has one). */
export async function logGoalSession(ownerId: string, kind: string, date: string, minutes: number | null): Promise<ActionResult & { id?: string }> {
  const k = z.enum(WORKOUT_KINDS).safeParse(kind === "any" ? "other" : kind);
  if (!k.success || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid workout" };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data, error } = await session.supabase
      .from("workout_logs")
      .insert({ owner_id: ownerId, household_id: session.household.id, performed_on: date, kind: k.data, title: kind === "any" ? "Workout" : (KIND_LABEL[k.data] ?? "Workout"), status: "done", duration_minutes: minutes })
      .select("id")
      .single();
    if (error) return { error: "Couldn't save." };
    refreshModule("/fitness");
    return { ok: true, id: data.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
