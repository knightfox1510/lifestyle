"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { saveHealthConnect } from "@/lib/health-connect-import";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { METRIC_KEYS } from "@/modules/wearables/csv";
import type { ActionResult } from "@/lib/types";

const blank = (v: unknown) => (v === "" || v == null ? null : v);
const n = (max: number) => z.preprocess(blank, z.coerce.number().min(0).max(max).nullable());

const daySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: n(200000).optional(),
  resting_hr: n(220).optional(),
  avg_hr: n(220).optional(),
  sleep_minutes: n(1440).optional(),
  deep_sleep_minutes: n(1440).optional(),
  active_minutes: n(1440).optional(),
  calories_burned: n(20000).optional(),
  hrv_ms: n(500).optional(),
});

export async function saveManualDay(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(form);
  const sleepHours = raw.sleep_hours ? Number(raw.sleep_hours) * 60 : undefined;
  const parsed = daySchema.safeParse({ ...raw, sleep_minutes: sleepHours ?? raw.sleep_minutes });
  if (!parsed.success) return { error: "Check the numbers." };
  const values = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== null && v !== undefined));
  if (Object.keys(values).length < 2) return { error: "Enter at least one value." };
  try {
    const session = await requireWrite("wearables", (await getSession()).userId);
    const { error } = await session.supabase
      .from("wearable_daily")
      .upsert({ ...values, owner_id: session.userId, household_id: session.household.id, source: "manual" }, { onConflict: "owner_id,day" });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/wearables");
  return { ok: true, message: "Saved." };
}

/** Bulk import of parsed CSV rows (all rows share the same keys). */
export async function importRows(rows: unknown): Promise<ActionResult> {
  const parsed = z.array(daySchema).min(1).max(2000).safeParse(rows);
  if (!parsed.success) return { error: "The file had invalid rows." };
  const keys = Object.keys(parsed.data[0]).filter((k) => k === "day" || (METRIC_KEYS as readonly string[]).includes(k));
  try {
    const session = await requireWrite("wearables", (await getSession()).userId);
    const payload = parsed.data.map((r) => ({
      ...Object.fromEntries(keys.map((k) => [k, (r as Record<string, unknown>)[k] ?? null])),
      owner_id: session.userId,
      household_id: session.household.id,
      source: "csv",
    }));
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await session.supabase.from("wearable_daily").upsert(payload.slice(i, i + 500), { onConflict: "owner_id,day" });
      if (error) return { error: "Import failed part-way. Try again." };
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/wearables");
  return { ok: true, message: `Imported ${parsed.data.length} days.` };
}

/** Creates a sync token. The plain token is returned once and only its hash is stored. */
export async function createIngestToken(label: string): Promise<ActionResult & { token?: string }> {
  const session = await getSession();
  const token = `hth_${randomBytes(24).toString("base64url")}`;
  const { error } = await session.supabase.from("ingest_tokens").insert({
    user_id: session.userId,
    token_hash: createHash("sha256").update(token).digest("hex"),
    label: (label || "Wearable sync").slice(0, 60),
  });
  if (error) return { error: "Couldn't create a token." };
  revalidatePath("/wearables");
  return { ok: true, token };
}

export async function revokeIngestToken(id: string) {
  const session = await getSession();
  await session.supabase.from("ingest_tokens").delete().eq("id", id).eq("user_id", session.userId);
  revalidatePath("/wearables");
}

const weightSchema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), at: z.iso.datetime({ offset: true }), weight_kg: z.number().min(20).max(350) });
const chunkSchema = z.object({
  days: z.array(daySchema).max(1000),
  weights: z.array(weightSchema).max(2000),
  found: z.array(z.string().max(40)).max(20),
  missing: z.array(z.string().max(40)).max(20),
  sessions: z
    .array(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.number().int(), minutes: z.number().int().min(1).max(600), type: z.number().int().min(0).max(200), kind: z.enum(["gym", "yoga", "pilates", "swim", "run", "walk", "cycle", "dance", "sport", "class", "other"]) }))
    .max(2000)
    .optional(),
});

/**
 * Saves part of a Health Connect export that this device read itself (the
 * file never leaves the phone or computer, only the daily totals do).
 */
export async function saveHealthConnectChunk(input: unknown): Promise<ActionResult & { days?: number; weights?: number; workouts?: number }> {
  const session = await getSession();
  if (!session.isModuleEnabled("wearables")) return { error: "Wearables are turned off." };
  const parsed = chunkSchema.safeParse(input);
  if (!parsed.success) return { error: "Couldn't read those days." };
  const days = parsed.data.days.map((d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v != null))) as typeof parsed.data.days;
  try {
    const res = await saveHealthConnect(session.supabase, session.userId, session.household.id, { ...parsed.data, days: days as never }, { bodyOn: session.isModuleEnabled("body_recomp"), fitnessOn: session.isModuleEnabled("fitness") });
    return { ok: true, days: res.days, weights: res.weights, workouts: res.workouts };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Records the result of a manual import, so it shows next to the daily sync's. */
export async function finishHealthConnectImport(input: { file: string; days: number; weights: number; workouts?: number; firstDay: string | null; lastDay: string | null; found: string[] }): Promise<ActionResult> {
  const session = await getSession();
  const ok = input.days > 0;
  const day = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const message = ok
    ? `Manual upload: imported ${input.days} days (${day(input.firstDay)} to ${day(input.lastDay)}): ${input.found.slice(0, 10).join(", ")}${input.weights ? `, plus ${input.weights} weigh-ins` : ""}${input.workouts ? `, plus ${input.workouts} workouts for Fitness` : ""}.`
    : "Manual upload: nothing to import.";
  const { data: last } = await session.supabase.from("health_connect_syncs").select("last_day").eq("user_id", session.userId).maybeSingle();
  const lastDay = [day(input.lastDay), last?.last_day ?? null].filter(Boolean).sort().at(-1) ?? null;
  await createAdminClient().from("health_connect_syncs").upsert(
    { user_id: session.userId, last_run_at: new Date().toISOString(), last_status: ok ? "ok" : "error", last_message: message.slice(0, 500), last_file: String(input.file).slice(0, 300), last_day: lastDay, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  refreshModule("/wearables");
  refreshModule("/body");
  return ok ? { ok: true, message } : { error: message };
}
