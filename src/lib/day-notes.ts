import "server-only";

import type { AppSession } from "@/lib/session";

/**
 * The one-line notes people add when closing a day ("travelled", "felt
 * unwell"), from `from` on, for marking trends. Partners see them only with
 * the check-in share (the database checks it).
 */
export async function dayNotes(session: AppSession, ownerId: string, from: string): Promise<{ key: string; label: string }[]> {
  const { data } = await session.supabase.from("day_closes").select("day, note").eq("owner_id", ownerId).gte("day", from).not("note", "is", null).order("day");
  return ((data ?? []) as { day: string; note: string | null }[]).filter((d) => d.note).map((d) => ({ key: d.day, label: d.note!.slice(0, 60) }));
}
