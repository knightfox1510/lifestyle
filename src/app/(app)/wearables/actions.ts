"use server";

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
