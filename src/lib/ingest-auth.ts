import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Resolves a sync token (Authorization: Bearer …) to its person, household and time zone. */
export async function ingestUser(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token.length < 20) return null;
  const admin = createAdminClient();
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: tok } = await admin.from("ingest_tokens").select("id, user_id").eq("token_hash", hash).maybeSingle();
  if (!tok) return null;
  const { data: profile } = await admin.from("profiles").select("active_household_id, timezone").eq("id", tok.user_id).single();
  if (!profile?.active_household_id) return null;
  await admin.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);
  return { admin, userId: tok.user_id as string, householdId: profile.active_household_id as string, tz: (profile.timezone as string) || "Asia/Kolkata" };
}
