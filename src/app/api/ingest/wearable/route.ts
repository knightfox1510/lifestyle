import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wearable sync webhook. Authenticate with a per-user token from
 * Wearables → Automatic sync:  Authorization: Bearer <token>
 *
 * Body: { "days": [ { "date": "2026-11-01", "steps": 8123, "sleep_minutes": 412,
 *         "deep_sleep_minutes": 80, "resting_hr": 61, "avg_hr": 74,
 *         "active_minutes": 45, "calories_burned": 2100, "hrv_ms": 42 } ] }
 * A single day object (without "days") is accepted too. Only fields sent are updated.
 */
const metric = (max: number) => z.number().min(0).max(max).optional();
const day = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: metric(200000),
  resting_hr: metric(220),
  avg_hr: metric(220),
  sleep_minutes: metric(1440),
  deep_sleep_minutes: metric(1440),
  active_minutes: metric(1440),
  calories_burned: metric(20000),
  hrv_ms: metric(500),
});
const body = z.union([z.object({ days: z.array(day).min(1).max(400) }), day.transform((d) => ({ days: [d] }))]);

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token.length < 20) return NextResponse.json({ error: "Missing token" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues.slice(0, 3) }, { status: 400 });

  const admin = createAdminClient();
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: tok } = await admin.from("ingest_tokens").select("id, user_id").eq("token_hash", hash).maybeSingle();
  if (!tok) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("active_household_id").eq("id", tok.user_id).single();
  if (!profile?.active_household_id) return NextResponse.json({ error: "No household" }, { status: 409 });

  // Group days by the set of fields they carry so each upsert only touches those columns.
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const d of parsed.data.days) {
    const { date, ...metrics } = d;
    const fields = Object.entries(metrics).filter(([, v]) => v !== undefined);
    if (!fields.length) continue;
    const key = fields.map(([k]) => k).sort().join(",");
    const row = { owner_id: tok.user_id, household_id: profile.active_household_id, day: date, source: "webhook", ...Object.fromEntries(fields.map(([k, v]) => [k, Math.round(v as number)])) };
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const rows of groups.values()) {
    const { error } = await admin.from("wearable_daily").upsert(rows, { onConflict: "owner_id,day" });
    if (error) return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  }
  await admin.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);
  return NextResponse.json({ ok: true, days: parsed.data.days.length });
}
