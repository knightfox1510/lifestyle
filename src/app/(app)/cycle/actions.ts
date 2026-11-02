"use server";

import { z } from "zod";
import { dbErrorMessage, errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { FLOWS, SYMPTOMS } from "@/modules/cycle/logic";
import type { ActionResult } from "@/lib/types";
import { todayIn } from "@/lib/dates";

const MODULE = "cycle";

const daySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  flow: z.enum(FLOWS).nullable(),
  symptoms: z.array(z.enum(SYMPTOMS)).max(SYMPTOMS.length),
  notes: z.string().trim().max(500).nullable().optional(),
});

/** Saves (or clears) one day: flow, symptoms and a note. */
export async function saveCycleDay(ownerId: string, input: unknown): Promise<ActionResult> {
  const parsed = daySchema.safeParse(input);
  if (!parsed.success) return { error: "Check the day's details." };
  const v = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    if (v.day > todayIn(session.profile.timezone)) return { error: "You can't log a future day." };
    const empty = !v.flow && !v.symptoms.length && !v.notes;
    const { error } = empty
      ? await session.supabase.from("cycle_days").delete().eq("owner_id", ownerId).eq("day", v.day)
      : await session.supabase
          .from("cycle_days")
          .upsert(
            { owner_id: ownerId, created_by: session.userId, household_id: session.household.id, day: v.day, flow: v.flow, symptoms: [...new Set(v.symptoms)], notes: v.notes || null },
            { onConflict: "owner_id,day" },
          );
    if (error) {
      console.error("cycle save failed", error.code, error.message);
      return { error: dbErrorMessage(error, "Couldn't save the day.") };
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/cycle");
  return { ok: true, message: "Saved." };
}

/** "Period started": logs medium flow on that day (keeps symptoms already logged). */
export async function periodStarted(ownerId: string, day: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Pick a day." };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data } = await session.supabase.from("cycle_days").select("symptoms, notes").eq("owner_id", ownerId).eq("day", day).maybeSingle();
    return saveCycleDay(ownerId, { day, flow: "medium", symptoms: (data?.symptoms as string[] | undefined) ?? [], notes: data?.notes ?? null });
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
