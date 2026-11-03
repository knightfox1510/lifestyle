"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { localInputToIso } from "@/lib/dates";

const sessionSchema = z.object({
  ownerId: z.uuid(),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(50),
  hold_seconds: z.number().int().min(1).max(60),
  relax_seconds: z.number().int().min(1).max(60),
  quick_flicks: z.number().int().min(0).max(50),
  completed: z.boolean(),
  duration_seconds: z.number().int().min(0).max(7200),
});

export async function saveKegelSession(input: z.input<typeof sessionSchema>): Promise<ActionResult> {
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid session" };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite("pelvic_floor", ownerId);
    const { error } = await session.supabase
      .from("pelvic_floor_sessions")
      .insert({ ...values, owner_id: ownerId, household_id: session.household.id });
    if (error) return { error: "Couldn't save the session." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/pelvic-floor");
  return { ok: true, message: values.completed ? "Session saved. Nice work! 💪" : "Partial session saved." };
}

export async function deleteKegelSession(id: string) {
  const session = await getSession();
  await session.supabase.from("pelvic_floor_sessions").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/pelvic-floor");
}

/** Fix a logged session: when, sets, reps, hold and whether it was finished. */
export async function updateKegelSession(id: string, ownerId: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = sessionSchema.omit({ ownerId: true, duration_seconds: true }).safeParse({ ...input, completed: Boolean(input.completed) });
  if (!parsed.success) return { error: "Check the numbers." };
  try {
    const session = await requireWrite("pelvic_floor", ownerId);
    const when = localInputToIso(input.when, session.profile.timezone);
    if (input.when && !when) return { error: "Pick a time that isn't in the future." };
    const { data, error } = await session.supabase.from("pelvic_floor_sessions").update({ ...parsed.data, ...(when ? { performed_at: when } : {}) }).eq("id", id).eq("owner_id", ownerId).select("id");
    if (error || !data?.length) return { error: "Couldn't save the changes." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/pelvic-floor");
  return { ok: true, message: "Saved." };
}
