import "server-only";

import type { AppSession } from "@/lib/session";
import { localDate, startOfLocalDayIso } from "@/lib/dates";

/** Water drunk today (local day) by this person, from the fluid log. */
export async function waterToday(session: AppSession, ownerId = session.userId) {
  const tz = session.profile.timezone;
  const today = localDate(new Date(), tz);
  const { data } = await session.supabase
    .from("fluid_intake")
    .select("volume_ml, occurred_at, drink")
    .eq("owner_id", ownerId)
    .gte("occurred_at", startOfLocalDayIso(today));
  const rows = ((data ?? []) as { volume_ml: number; occurred_at: string; drink: string }[]).filter((r) => localDate(r.occurred_at, tz) === today);
  // All drinks count towards hydration except alcohol.
  return { ml: rows.filter((r) => r.drink !== "alcohol").reduce((a, r) => a + r.volume_ml, 0), water: rows.filter((r) => r.drink === "water").reduce((a, r) => a + r.volume_ml, 0) };
}

/** The person's daily water target: reminder setting → nutrition goal → 2000 ml. */
export async function waterTarget(session: AppSession, ownerId = session.userId) {
  const [{ data: prefs }, { data: goal }] = await Promise.all([
    session.supabase.from("notification_prefs").select("water_target_ml").eq("user_id", ownerId).maybeSingle(),
    session.supabase.from("nutrition_goals").select("water_ml").eq("owner_id", ownerId).maybeSingle(),
  ]);
  return (prefs as { water_target_ml: number | null } | null)?.water_target_ml ?? (goal as { water_ml: number | null } | null)?.water_ml ?? 2000;
}

/** Logs water for yourself (your own rows are always writable, whatever modules are on). */
export async function insertWater(session: AppSession, ml: number) {
  const { error } = await session.supabase.from("fluid_intake").insert({
    owner_id: session.userId,
    created_by: session.userId,
    household_id: session.household.id,
    drink: "water",
    volume_ml: ml,
    caffeinated: false,
  });
  return !error;
}
