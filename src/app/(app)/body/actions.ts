"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

const MODULE = "body_recomp";
const blank = (v: unknown) => (v === "" || v == null ? null : v);
const n = (min: number, max: number) => z.preprocess(blank, z.coerce.number().min(min).max(max).nullable());
const int = (min: number, max: number) => z.preprocess(blank, z.coerce.number().int().min(min).max(max).nullable());

const metricSchema = z.object({
  ownerId: z.uuid(),
  measured_at: z.preprocess(blank, z.iso.datetime({ offset: true }).nullable()),
  weight_kg: n(20, 350),
  body_fat_pct: n(2, 75),
  waist_cm: n(30, 250),
  hip_cm: n(30, 250),
  chest_cm: n(30, 250),
  arm_cm: n(10, 80),
  thigh_cm: n(20, 120),
  resting_hr: int(25, 220),
  bp_systolic: int(60, 260),
  bp_diastolic: int(30, 160),
  blood_glucose_mgdl: int(20, 600),
  glucose_context: z.preprocess(blank, z.enum(["fasting", "post_meal", "random"]).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

export async function logBodyMetric(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = metricSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const { ownerId, measured_at, ...values } = parsed.data;
  if (Object.entries(values).every(([k, v]) => v === null || k === "notes" || k === "glucose_context")) return { error: "Enter at least one measurement." };
  if ((values.bp_systolic === null) !== (values.bp_diastolic === null)) return { error: "Enter both blood pressure numbers." };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase.from("body_metrics").insert({
      ...values,
      glucose_context: values.blood_glucose_mgdl === null ? null : values.glucose_context,
      measured_at: measured_at ?? new Date().toISOString(),
      owner_id: ownerId,
      created_by: session.userId,
      household_id: session.household.id,
    });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/body");
  return { ok: true, message: "Saved." };
}

export async function deleteBodyMetric(id: string) {
  const session = await getSession();
  await session.supabase.from("body_metrics").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/body");
}

const goalsSchema = z.object({
  ownerId: z.uuid(),
  start_weight_kg: n(20, 350),
  target_weight_kg: n(20, 350),
  target_date: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  target_body_fat_pct: n(2, 75),
  milestones: z.array(z.number().min(20).max(350)).max(20),
});

export async function saveBodyGoals(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = goalsSchema.safeParse({
    ...Object.fromEntries(form),
    milestones: String(form.get("milestones") ?? "")
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number),
  });
  if (!parsed.success) return { error: "Check the numbers (milestones are weights separated by commas)." };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase
      .from("body_goals")
      .upsert({ ...values, milestones: [...new Set(values.milestones)].sort((a, b) => b - a), owner_id: ownerId, household_id: session.household.id }, { onConflict: "owner_id" });
    if (error) return { error: "Couldn't save goals." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/body");
  return { ok: true, message: "Goal saved." };
}
