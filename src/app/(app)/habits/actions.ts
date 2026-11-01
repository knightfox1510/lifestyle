"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

const habitSchema = z.object({
  ownerId: z.uuid(),
  name: z.string().trim().min(1, "Name your habit").max(80),
  icon: z.string().trim().min(1).max(8).catch("✅"),
  target_per_week: z.coerce.number().int().min(1).max(7),
});

export async function addHabit(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = habitSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite("habits", ownerId);
    const { count } = await session.supabase.from("habits").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
    const { error } = await session.supabase.from("habits").insert({ ...values, owner_id: ownerId, household_id: session.household.id, sort: count ?? 0 });
    if (error) return { error: "Couldn't add the habit." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/habits");
  return { ok: true, message: "Habit added." };
}

export async function toggleHabit(habitId: string, ownerId: string, date: string, done: boolean): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date" };
  try {
    const session = await requireWrite("habits", ownerId);
    const { error } = done
      ? await session.supabase
          .from("habit_logs")
          .upsert({ habit_id: habitId, owner_id: ownerId, log_date: date }, { onConflict: "habit_id,log_date", ignoreDuplicates: true })
      : await session.supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", date);
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/habits");
  return { ok: true };
}

export async function archiveHabit(id: string, ownerId: string, active: boolean) {
  const session = await requireWrite("habits", ownerId);
  await session.supabase.from("habits").update({ active }).eq("id", id);
  refreshModule("/habits");
}

export async function deleteHabit(id: string) {
  const session = await getSession();
  await session.supabase.from("habits").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/habits");
}
