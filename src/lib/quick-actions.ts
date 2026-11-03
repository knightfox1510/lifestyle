"use server";

import { getSession } from "@/lib/session";
import { localDate, localTime, todayIn } from "@/lib/dates";
import type { DailyCheckin, Medicine, MedicineDose, Supplement } from "@/lib/types";
import { slotsForDay } from "@/modules/medicines/logic";
import { deleteBladderEvent, deleteFluid } from "@/app/(app)/bladder/actions";
import { undoDose } from "@/app/(app)/medicines/actions";
import { toggleSupplement } from "@/app/(app)/supplements/actions";
import { supplementRepeat, timingTimes } from "@/modules/supplements/meta";
import { isDueOn } from "@/modules/schedule";

export type DueSupplement = { supplementId: string; name: string; dose: string | null; time: string | null; date: string };
export type DueDose = { medicineId: string; name: string; strength: string | null; time: string; date: string; overdue: boolean };

/** What the ＋ sheet needs, fetched only when it opens (keeps every page fast). */
export async function getQuickLogData() {
  const session = await getSession();
  const me = session.userId;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const now = localTime(new Date(), tz);
  const on = (m: string) => session.isModuleEnabled(m);
  const [meds, doses, weight, checkin, supps, suppLogs] = await Promise.all([
    on("medicines") ? session.supabase.from("medicines").select("*").eq("owner_id", me).eq("active", true) : Promise.resolve({ data: [] }),
    on("medicines") ? session.supabase.from("medicine_doses").select("*").eq("owner_id", me).eq("scheduled_date", today) : Promise.resolve({ data: [] }),
    on("body_recomp") ? session.supabase.from("body_metrics").select("weight_kg").eq("owner_id", me).not("weight_kg", "is", null).order("measured_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    on("checkin") ? session.supabase.from("daily_checkins").select("*").eq("owner_id", me).eq("checkin_date", today).maybeSingle() : Promise.resolve({ data: null }),
    on("supplements") ? session.supabase.from("supplements").select("*").eq("owner_id", me).eq("active", true).order("sort") : Promise.resolve({ data: [] }),
    on("supplements") ? session.supabase.from("supplement_logs").select("supplement_id").eq("owner_id", me).eq("log_date", today) : Promise.resolve({ data: [] }),
  ]);
  const takenSupps = new Set(((suppLogs.data ?? []) as { supplement_id: string }[]).map((l) => l.supplement_id));
  const sTimes = timingTimes(session.profile.supplement_times);
  const dueSupplements: DueSupplement[] = ((supps.data ?? []) as (Supplement & { created_at: string })[])
    .filter((x) => !takenSupps.has(x.id) && isDueOn(supplementRepeat(x, (iso) => localDate(iso, tz)), today))
    .map((x) => ({ supplementId: x.id, name: x.name, dose: x.dose, time: sTimes[x.timing], date: today }))
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  const due: DueDose[] = slotsForDay((meds.data ?? []) as Medicine[], (doses.data ?? []) as MedicineDose[], today)
    .filter((s) => !s.dose)
    .map((s) => ({ medicineId: s.medicine.id, name: s.medicine.name, strength: s.medicine.strength, time: s.time, date: today, overdue: s.time < now }))
    .slice(0, 8);
  return {
    today,
    due,
    dueSupplements,
    lastWeight: (weight.data as { weight_kg: number | null } | null)?.weight_kg ?? null,
    checkin: (checkin.data ?? null) as DailyCheckin | null,
  };
}

export async function undoQuickLog(kind: "water" | "bladder" | "dose" | "supplement", id: string) {
  const session = await getSession();
  if (kind === "supplement") {
    // id is "supplementId|date"
    const [supplementId, date] = id.split("|");
    await toggleSupplement(supplementId, session.userId, date, false);
    return;
  }
  if (kind === "water") await deleteFluid(id, session.userId);
  else if (kind === "bladder") await deleteBladderEvent(id, session.userId);
  else await undoDose(id, session.userId);
}
