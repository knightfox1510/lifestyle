import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildSession, type AppSession } from "@/lib/session";
import type { Profile } from "@/lib/types";

/**
 * Context for background jobs (cron, digests) acting for one user. Uses the
 * service-role client, but every query in the shared builders is scoped to
 * the user's household / shares exactly like the in-app session.
 */
export async function serviceSession(userId: string): Promise<AppSession | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();
  if (!profile?.active_household_id) return null;
  return buildSession(admin as unknown as AppSession["supabase"], userId, null, profile as Profile, "me");
}
