"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import type { ActionResult } from "@/lib/types";

const FIELDS = ["sleep_quality", "mood", "energy", "stress", "sleep_hours", "notes"] as const;
type CheckinField = (typeof FIELDS)[number];

const valueFor: Record<CheckinField, z.ZodType> = {
  sleep_quality: z.number().int().min(1).max(5).nullable(),
  mood: z.number().int().min(1).max(5).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  stress: z.number().int().min(1).max(5).nullable(),
  sleep_hours: z.number().min(0).max(24).nullable(),
  notes: z.string().trim().max(1000).nullable(),
};

/** Saves one field of a day's check-in (each tap saves). */
export async function saveCheckinField(ownerId: string, date: string, field: CheckinField, value: number | string | null): Promise<ActionResult> {
  if (!FIELDS.includes(field) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid input" };
  const parsed = valueFor[field].safeParse(value === "" ? null : value);
  if (!parsed.success) return { error: "Invalid value" };
  try {
    const session = await requireWrite("checkin", ownerId);
    const { error } = await session.supabase
      .from("daily_checkins")
      .upsert({ owner_id: ownerId, household_id: session.household.id, checkin_date: date, [field]: parsed.data }, { onConflict: "owner_id,checkin_date" });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/checkin");
  return { ok: true };
}
