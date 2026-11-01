"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

/**
 * Permanently deletes the account: hands household ownership to another
 * member (or removes a household left empty), deletes uploaded files, then
 * deletes the auth user, which cascades to every personal row.
 */
export async function deleteAccount(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (String(form.get("confirm") ?? "").trim() !== "DELETE") return { error: 'Type DELETE (in capitals) to confirm.' };
  const session = await getSession();
  const { error: prepError } = await session.supabase.rpc("prepare_account_deletion");
  if (prepError) return { error: "Couldn't prepare the deletion. Try again." };

  const admin = createAdminClient();
  // Remove uploaded files under the user's folder (paged).
  for (let i = 0; i < 20; i++) {
    const { data: files } = await admin.storage.from("medical-documents").list(session.userId, { limit: 100 });
    if (!files?.length) break;
    await admin.storage.from("medical-documents").remove(files.map((f) => `${session.userId}/${f.name}`));
    if (files.length < 100) break;
  }
  const { error } = await admin.auth.admin.deleteUser(session.userId);
  if (error) return { error: "Couldn't delete the account. Contact support." };
  await session.supabase.auth.signOut();
  redirect("/login?error=" + encodeURIComponent("Your account and data have been deleted."));
}
