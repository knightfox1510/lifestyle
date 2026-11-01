import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, lastNDays, startOfLocalDayIso, todayIn } from "@/lib/dates";
import type { BladderEvent, DailyCheckin, FluidIntake, PelvicFloorSession } from "@/lib/types";

/** Loads a person's diary for the last `days` days (including today). */
export async function loadDiary(session: AppSession, ownerId: string, days: number) {
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const dayList = lastNDays(today, days);
  const from = startOfLocalDayIso(dayList[0]);
  const canSeeKegel = session.isModuleEnabled("pelvic_floor") && session.accessTo("pelvic_floor", ownerId) !== "none";
  const canSeeCheckin = session.isModuleEnabled("checkin") && session.accessTo("checkin", ownerId) !== "none";
  const canSeeFitness = session.isModuleEnabled("fitness") && session.accessTo("fitness", ownerId) !== "none";

  const [ev, fl, pf, ci, wo] = await Promise.all([
    session.supabase.from("bladder_events").select("*").eq("owner_id", ownerId).gte("occurred_at", from).order("occurred_at").limit(5000),
    session.supabase.from("fluid_intake").select("*").eq("owner_id", ownerId).gte("occurred_at", from).order("occurred_at").limit(5000),
    canSeeKegel
      ? session.supabase.from("pelvic_floor_sessions").select("*").eq("owner_id", ownerId).gte("performed_at", from)
      : Promise.resolve({ data: [] }),
    canSeeCheckin
      ? session.supabase.from("daily_checkins").select("*").eq("owner_id", ownerId).gte("checkin_date", addDays(today, -days))
      : Promise.resolve({ data: [] }),
    canSeeFitness
      ? session.supabase.from("workout_logs").select("performed_on, kind, status").eq("owner_id", ownerId).gte("performed_on", dayList[0])
      : Promise.resolve({ data: [] }),
  ]);

  return {
    tz,
    today,
    days: dayList,
    events: (ev.data ?? []) as BladderEvent[],
    fluids: (fl.data ?? []) as FluidIntake[],
    sessions: (pf.data ?? []) as PelvicFloorSession[],
    checkins: (ci.data ?? []) as DailyCheckin[],
    workouts: (wo.data ?? []) as { performed_on: string; kind: string; status: string }[],
  };
}
