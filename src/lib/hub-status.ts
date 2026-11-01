import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, localTime, startOfLocalDayIso, todayIn, localDate } from "@/lib/dates";
import type { Medicine, MedicineDose } from "@/lib/types";
import { slotsForDay } from "@/modules/medicines/logic";
import type { T } from "@/lib/i18n/core";

/** One-line live statuses for hub tiles. Cheap counts only; missing modules return nothing. */
export async function hubStatuses(session: AppSession, t: T): Promise<Record<string, { text: string; alert?: boolean }>> {
  const me = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const can = (m: string) => session.isModuleEnabled(m) && session.accessTo(m, me) !== "none";
  const hid = session.household.id;
  const none = Promise.resolve({ data: null as unknown, count: null as number | null });
  const [meds, doses, supps, suppLogs, bladder, groceries, pantry, checkin, lab] = await Promise.all([
    can("medicines") ? session.supabase.from("medicines").select("*").eq("owner_id", me).eq("active", true) : none,
    can("medicines") ? session.supabase.from("medicine_doses").select("*").eq("owner_id", me).eq("scheduled_date", today) : none,
    can("supplements") ? session.supabase.from("supplements").select("id", { count: "exact", head: true }).eq("owner_id", me).eq("active", true) : none,
    can("supplements") ? session.supabase.from("supplement_logs").select("supplement_id", { count: "exact", head: true }).eq("owner_id", me).eq("log_date", today) : none,
    can("bladder_diary") ? session.supabase.from("bladder_events").select("kind, occurred_at").eq("owner_id", me).gte("occurred_at", startOfLocalDayIso(today)) : none,
    session.isModuleEnabled("groceries") ? session.supabase.from("grocery_items").select("id", { count: "exact", head: true }).eq("household_id", hid).eq("checked", false) : none,
    session.isModuleEnabled("pantry") ? session.supabase.from("pantry_items").select("id", { count: "exact", head: true }).eq("household_id", hid).is("used_up_at", null).lte("expires_on", addDays(today, 3)) : none,
    can("checkin") ? session.supabase.from("daily_checkins").select("owner_id", { count: "exact", head: true }).eq("owner_id", me).eq("checkin_date", today) : none,
    can("medical_records") ? session.supabase.from("lab_results").select("id", { count: "exact", head: true }).eq("owner_id", me).neq("flag", "normal").gte("test_date", addDays(today, -365)) : none,
  ]);
  const out: Record<string, { text: string; alert?: boolean }> = {};
  if (meds.data) {
    const slots = slotsForDay(meds.data as Medicine[], (doses.data ?? []) as MedicineDose[], today);
    const open = slots.filter((s) => !s.dose);
    const now = localTime(new Date(), tz);
    out.medicines = !slots.length ? { text: t("Nothing scheduled today.") } : open.length ? { text: t("{n} doses left today", { n: open.length }), alert: open.some((s) => s.time < now) } : { text: `✓ ${t("All doses done")}` };
  }
  if (supps.count != null) out.supplements = supps.count ? { text: t("{done} of {total} today", { done: suppLogs.count ?? 0, total: supps.count }) } : { text: t("None added yet") };
  if (bladder.data) {
    const ev = (bladder.data as { kind: string; occurred_at: string }[]).filter((e) => localDate(e.occurred_at, tz) === today);
    out.bladder_diary = { text: t("Today: {leaks} leaks · {voids} bathroom", { leaks: ev.filter((e) => e.kind === "leak").length, voids: ev.filter((e) => e.kind === "void").length }) };
  }
  if (groceries.count != null) out.groceries = { text: groceries.count ? t("{n} items to buy", { n: groceries.count }) : t("List is empty") };
  if (pantry.count != null && pantry.count > 0) out.pantry = { text: t("{n} expiring soon", { n: pantry.count }), alert: true };
  if (checkin.count != null) out.checkin = checkin.count ? { text: `✓ ${t("Done today")}` } : { text: t("Not done yet") };
  if (lab.count) out.medical_records = { text: t("{n} results to watch", { n: lab.count }), alert: true };
  return out;
}
