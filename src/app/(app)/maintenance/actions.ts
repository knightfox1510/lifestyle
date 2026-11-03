"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { addDays, todayIn } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";

const blank = (v: unknown) => (v === "" || v == null ? null : v);
const taskSchema = z.object({
  id: z.preprocess(blank, z.uuid().nullable()),
  title: z.string().trim().min(1, "Name the task").max(120),
  category: z.enum(["appliance", "vehicle", "home", "insurance", "health", "other"]),
  interval_days: z.preprocess(blank, z.coerce.number().int().min(1).max(3650).nullable()),
  last_done_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  next_due_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  remind_days_before: z.coerce.number().int().min(0).max(120).catch(7),
  vendor: z.preprocess(blank, z.string().trim().max(120).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

export async function saveTask(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...v } = parsed.data;
  const values = { ...v, next_due_on: v.next_due_on ?? (v.last_done_on && v.interval_days ? addDays(v.last_done_on, v.interval_days) : null) };
  try {
    const session = await requireModule("maintenance");
    const { error } = id
      ? await session.supabase.from("maintenance_tasks").update(values).eq("id", id).eq("household_id", session.household.id)
      : await session.supabase.from("maintenance_tasks").insert({ ...values, household_id: session.household.id, created_by: session.userId });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/maintenance");
  return { ok: true, message: "Saved." };
}

/** Adds a common task with a sensible interval, due now unless a date is known. */
export async function addTemplate(title: string, category: string, interval: number) {
  const session = await requireModule("maintenance");
  const parsed = taskSchema.safeParse({ title, category, interval_days: String(interval), next_due_on: todayIn(session.profile.timezone) });
  if (!parsed.success) return;
  const { id: _id, ...values } = parsed.data;
  void _id;
  await session.supabase.from("maintenance_tasks").insert({ ...values, household_id: session.household.id, created_by: session.userId });
  refreshModule("/maintenance");
}

export async function markDone(taskId: string, form: FormData) {
  const session = await requireModule("maintenance");
  const today = todayIn(session.profile.timezone);
  const doneOn = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch(today).parse(form.get("done_on") || today);
  const cost = z.preprocess(blank, z.coerce.number().min(0).max(10_000_000).nullable()).catch(null).parse(form.get("cost"));
  const { data: task } = await session.supabase.from("maintenance_tasks").select("*").eq("id", taskId).eq("household_id", session.household.id).single();
  if (!task) return;
  await session.supabase.from("maintenance_log").insert({ task_id: taskId, household_id: session.household.id, done_on: doneOn, done_by: session.userId, cost });
  await session.supabase
    .from("maintenance_tasks")
    .update({ last_done_on: doneOn, next_due_on: task.interval_days ? addDays(doneOn, task.interval_days) : null })
    .eq("id", taskId);
  refreshModule("/maintenance");
}

export async function deleteTask(id: string) {
  const session = await requireModule("maintenance");
  await session.supabase.from("maintenance_tasks").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/maintenance");
}

/** Edit a maintenance task (same rules as adding one). */
export async function updateTask(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const fd = new FormData();
  fd.set("id", id);
  for (const [k, v] of Object.entries(input)) fd.set(k, v == null ? "" : String(v));
  return saveTask(null, fd);
}
