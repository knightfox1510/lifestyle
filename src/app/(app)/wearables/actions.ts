"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { readHealthConnectExport, saveHealthConnect } from "@/lib/health-connect-import";
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

const UPLOAD_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.zip$/;

/** A one-time upload link for a Health Connect export picked on this device. */
export async function prepareHealthConnectUpload(): Promise<ActionResult & { path?: string; token?: string }> {
  const session = await getSession();
  if (!session.isModuleEnabled("wearables")) return { error: "Wearables are turned off." };
  const path = `${session.userId}/${crypto.randomUUID()}.zip`;
  const { data, error } = await createAdminClient().storage.from("health-imports").createSignedUploadUrl(path);
  if (error || !data) return { error: "Couldn't prepare the upload. Run the latest database update in Supabase." };
  return { ok: true, path, token: data.token };
}

/** Reads an uploaded Health Connect export and saves it (same as the daily sync). */
export async function importHealthConnectUpload(path: string, name: string): Promise<ActionResult> {
  const session = await getSession();
  if (!UPLOAD_PATH.test(path) || !path.startsWith(`${session.userId}/`)) return { error: "Invalid upload." };
  const admin = createAdminClient();
  try {
    const file = await admin.storage.from("health-imports").download(path);
    if (file.error || !file.data) return { error: "The upload didn't arrive. Try again." };
    const summary = await readHealthConnectExport(new Uint8Array(await file.data.arrayBuffer()), session.profile.timezone);
    const res = await saveHealthConnect(session.supabase, session.userId, session.household.id, summary, { bodyOn: session.isModuleEnabled("body_recomp") });
    const message = res.days
      ? `Imported ${res.days} days (${res.firstDay} to ${res.lastDay}): ${res.found.join(", ")}${res.weights ? `, plus ${res.weights} weigh-ins` : ""}.`
      : `Nothing to import. Tables in the file: ${summary.tables.slice(0, 15).join(", ") || "none"}.`;
    await admin.from("health_connect_syncs").upsert(
      { user_id: session.userId, last_run_at: new Date().toISOString(), last_status: res.days ? "ok" : "error", last_message: `Manual upload: ${message}`.slice(0, 500), last_file: name.slice(0, 300), last_day: res.lastDay, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    refreshModule("/wearables");
    refreshModule("/body");
    return res.days ? { ok: true, message } : { error: message };
  } catch (e) {
    return { error: errorMessage(e) };
  } finally {
    await admin.storage.from("health-imports").remove([path]);
  }
}
