import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, lastNDays, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { DIARY_EVENT_CATEGORIES, type DiaryEvent } from "@/modules/bladder/events";
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
  const canSeeFood = session.isModuleEnabled("food_diary") && session.accessTo("food_diary", ownerId) !== "none";

  const [ev, fl, pf, ci, wo, fd] = await Promise.all([
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
    canSeeFood
      ? session.supabase.from("food_entries").select("eaten_at, irritants").eq("owner_id", ownerId).gte("eaten_at", from).neq("irritants", "{}")
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
    foods: (fd.data ?? []) as { eaten_at: string; irritants: string[] | null }[],
  };
}

/** Surgery, procedures and medicine changes to show on the diary (empty when medical records aren't visible). */
export async function loadDiaryEvents(session: AppSession, ownerId: string, sinceDate: string): Promise<DiaryEvent[]> {
  if (session.accessTo("medical_records", ownerId) === "none") return [];
  const { data } = await session.supabase
    .from("medical_events")
    .select("id, title, category, start_date, details")
    .eq("owner_id", ownerId)
    .in("category", DIARY_EVENT_CATEGORIES)
    .gte("start_date", sinceDate)
    .order("start_date", { ascending: false })
    .limit(50);
  return (data ?? []) as DiaryEvent[];
}
