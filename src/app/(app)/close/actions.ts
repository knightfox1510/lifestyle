"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { addDays, todayIn } from "@/lib/dates";
import { announceDayClosed } from "@/lib/engagement-actions";
import type { ActionResult } from "@/lib/types";

const KEY = /^(dose:[0-9a-f-]{36}:\d{2}:\d{2}|supp:[0-9a-f-]{36}|meal:(breakfast|lunch|dinner)|water|check)$/;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const note = z.string().trim().max(280);

async function validDay(d: string) {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  if (!day.safeParse(d).success || d > today || d < addDays(today, -60)) return null;
  return session;
}

function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Closes a day: records when, what was skipped on purpose (so it isn't counted
 * as missed) and the day's note. Evening reminders stop for that day, and your
 * partner hears about it (if they want partner updates).
 */
export async function closeDay(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ date: day, skipped: z.array(z.string().regex(KEY)).max(60), note: note.optional() }).safeParse(input);
  if (!parsed.success) return { error: "Couldn't close the day." };
  const session = await validDay(parsed.data.date);
  if (!session) return { error: "Pick today or a recent day." };
  const { error } = await session.supabase.from("day_closes").upsert(
    { owner_id: session.userId, household_id: session.household.id, day: parsed.data.date, closed_at: new Date().toISOString(), skipped: [...new Set(parsed.data.skipped)], ...(parsed.data.note !== undefined ? { note: parsed.data.note || null } : {}), updated_at: new Date().toISOString() },
    { onConflict: "owner_id,day" },
  );
  if (error) return { error: error.code === "42P01" ? "Run the latest database update in Supabase first." : "Couldn't close the day." };
  if (parsed.data.date === todayIn(session.profile.timezone)) await announceDayClosed().catch(() => undefined);
  refresh();
  return { ok: true, message: "Day closed." };
}

/** Opens a closed day again: skips are cleared (the note stays). */
export async function reopenDay(date: string): Promise<ActionResult> {
  const session = await validDay(date);
  if (!session) return { error: "Pick today or a recent day." };
  await session.supabase.from("day_closes").update({ closed_at: null, skipped: [], updated_at: new Date().toISOString() }).eq("owner_id", session.userId).eq("day", date);
  refresh();
  return { ok: true, message: "Day reopened." };
}

/** The day's one-line note ("travelled", "felt unwell"), without closing it. */
export async function setDayNote(date: string, text: string): Promise<ActionResult> {
  const n = note.safeParse(text);
  const session = await validDay(date);
  if (!session || !n.success) return { error: "Keep the note under 280 characters." };
  const { error } = await session.supabase.from("day_closes").upsert(
    { owner_id: session.userId, household_id: session.household.id, day: date, note: n.data || null, updated_at: new Date().toISOString() },
    { onConflict: "owner_id,day" },
  );
  if (error) return { error: "Couldn't save the note." };
  refresh();
  return { ok: true, message: n.data ? "Note saved." : "Note removed." };
}
