import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, lastNDays, startOfLocalDayIso, todayIn } from "@/lib/dates";
import type { BladderEvent, DailyCheckin, FluidIntake, Habit, HabitLog, Medicine, MedicineDose, PelvicFloorSession, Supplement } from "@/lib/types";
import { adherence, doseLabel } from "@/modules/medicines/logic";
import { dailyStats, physicalShare, trend, triggerCounts } from "@/modules/bladder/analysis";
import { TIMING_LABEL } from "@/modules/supplements/meta";

/**
 * Recent tracking data (Phase 1 modules) for AI suggestions. Each section is
 * included only if the module is on and the asker can see the subject's data.
 */
export async function buildTrackingContext(session: AppSession, subjectId: string) {
  const can = (key: string) => session.isModuleEnabled(key) && session.accessTo(key, subjectId) !== "none";
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const days14 = lastNDays(today, 14);
  const from14 = startOfLocalDayIso(days14[0]);
  const db = session.supabase;
  const lines: string[] = [];

  const [meds, doses, sups, events, fluids, kegel, checkins, habits, habitLogs] = await Promise.all([
    can("medicines") ? db.from("medicines").select("*").eq("owner_id", subjectId).eq("active", true).eq("include_in_ai", true) : null,
    can("medicines") ? db.from("medicine_doses").select("*").eq("owner_id", subjectId).gte("scheduled_date", days14[0]) : null,
    can("supplements") ? db.from("supplements").select("*").eq("owner_id", subjectId).eq("active", true).eq("include_in_ai", true) : null,
    can("bladder_diary") ? db.from("bladder_events").select("*").eq("owner_id", subjectId).gte("occurred_at", from14) : null,
    can("bladder_diary") ? db.from("fluid_intake").select("*").eq("owner_id", subjectId).gte("occurred_at", from14) : null,
    can("pelvic_floor") ? db.from("pelvic_floor_sessions").select("*").eq("owner_id", subjectId).gte("performed_at", from14) : null,
    can("checkin") ? db.from("daily_checkins").select("*").eq("owner_id", subjectId).gte("checkin_date", addDays(today, -6)) : null,
    can("habits") ? db.from("habits").select("*").eq("owner_id", subjectId).eq("active", true) : null,
    can("habits") ? db.from("habit_logs").select("*").eq("owner_id", subjectId).gte("log_date", addDays(today, -6)) : null,
  ]);

  const medList = (meds?.data ?? []) as Medicine[];
  if (medList.length) {
    const doseList = (doses?.data ?? []) as MedicineDose[];
    const adh = adherence(medList, doseList, lastNDays(addDays(today, -1), 13));
    lines.push(
      "Current medicines (tracked):",
      ...medList.map(
        (m) =>
          `- ${m.name}${m.strength ? ` ${m.strength}` : ""}: ${doseLabel(m)} ${m.times.length ? `at ${m.times.join(", ")}` : "as needed"}${m.reason ? `, for ${m.reason}` : ""}${m.instructions ? ` (${m.instructions})` : ""}`,
      ),
    );
    if (adh.pct !== null) lines.push(`Medicine adherence last 2 weeks: ${adh.pct}%.`);
  }

  const supList = (sups?.data ?? []) as Supplement[];
  if (supList.length) {
    lines.push("", `Daily supplements: ${supList.map((s) => `${s.name}${s.dose ? ` ${s.dose}` : ""} (${TIMING_LABEL[s.timing].toLowerCase()})`).join("; ")}.`);
  }

  const ev = (events?.data ?? []) as BladderEvent[];
  const fl = (fluids?.data ?? []) as FluidIntake[];
  if (ev.length || fl.length) {
    const stats = dailyStats(days14, ev, fl, tz, (kegel?.data ?? []) as PelvicFloorSession[]);
    const logged = stats.filter((s) => s.leaks + s.urges + s.voids + s.fluidMl > 0);
    const n = Math.max(1, logged.length);
    const avg = (k: "leaks" | "urges" | "voids" | "fluidMl" | "caffeineMl") => (logged.reduce((a, s) => a + s[k], 0) / n).toFixed(k.endsWith("Ml") ? 0 : 1);
    const share = physicalShare(ev);
    const t = trend(stats);
    lines.push(
      "",
      `Bladder diary (urinary incontinence), last 14 days, ${logged.length} days logged: avg ${avg("leaks")} leaks/day, ${avg("urges")} urges/day, ${avg("voids")} toilet visits/day, ${avg("fluidMl")} ml fluids/day (${avg("caffeineMl")} ml caffeinated).`,
      `Leak circumstances: ${triggerCounts(ev).slice(0, 5).map((x) => `${x.label} ${x.value}`).join(", ") || "not recorded"}. ${share.physical}/${share.total} leaks with physical effort, ${share.urge}/${share.total} with strong urge.${t ? ` Trend: ${t.first} → ${t.second} leaks/day (${t.change > 0 ? "+" : ""}${t.change}%).` : ""}`,
      "When suggesting exercise, food or drinks, consider bladder irritants (caffeine, alcohol, fizzy drinks, spicy food), and pelvic-floor-friendly alternatives to high-impact or heavy-lifting moves.",
    );
  }

  const kg = ((kegel?.data ?? []) as PelvicFloorSession[]).filter((s) => s.completed);
  if (kg.length) lines.push("", `Pelvic floor sessions in last 14 days: ${kg.length}.`);

  const ci = (checkins?.data ?? []) as DailyCheckin[];
  if (ci.length) {
    const mean = (k: "sleep_hours" | "sleep_quality" | "mood" | "energy" | "stress") => {
      const v = ci.map((c) => c[k]).filter((x): x is number => x !== null).map(Number);
      return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "–";
    };
    lines.push("", `Check-ins last 7 days (1–5 scales): sleep ${mean("sleep_hours")} h, sleep quality ${mean("sleep_quality")}, mood ${mean("mood")}, energy ${mean("energy")}, stress ${mean("stress")}.`);
    const todayNote = ci.find((c) => c.checkin_date === today)?.notes;
    if (todayNote) lines.push(`Today's note: ${todayNote.slice(0, 300)}`);
  }

  const hb = (habits?.data ?? []) as Habit[];
  if (hb.length) {
    const logs = (habitLogs?.data ?? []) as HabitLog[];
    lines.push("", `Habits (done in last 7 days / target per week): ${hb.map((h) => `${h.name} ${logs.filter((l) => l.habit_id === h.id).length}/${h.target_per_week}`).join(", ")}.`);
  }

  return lines.join("\n").trim();
}
