import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, lastNDays, todayIn } from "@/lib/dates";
import type { BodyMetric, DailyCheckin, LabResult, MedicalEvent, MedicalProfile, Medicine, MedicineDose, Supplement, WearableDay } from "@/lib/types";
import { adherence, doseLabel } from "@/modules/medicines/logic";
import { dailyStats, triggerCounts } from "@/modules/bladder/analysis";
import { loadDiary } from "@/modules/bladder/load";
import { ageOn, bladderSummary, vitalsSummary, wellbeingSummary } from "@/modules/medical/visit";
import { medicineChecksFor } from "@/lib/medicine-checks";

export const VISIT_PERIODS = [30, 90, 180, 365] as const;

/** Everything a doctor-visit summary shows, respecting what the viewer may see. */
export async function loadVisitData(session: AppSession, ownerId: string, days: number) {
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const from = addDays(today, -days + 1);
  const can = (m: string) => session.isModuleEnabled(m) && session.accessTo(m, ownerId) !== "none";
  const none = Promise.resolve({ data: [] as unknown[] });

  const [prof, events, labs, meds, doses, supps, metrics, checkins, wear] = await Promise.all([
    can("medical_records") ? session.supabase.from("medical_profiles").select("*").eq("owner_id", ownerId).maybeSingle() : Promise.resolve({ data: null }),
    can("medical_records") ? session.supabase.from("medical_events").select("*").eq("owner_id", ownerId).order("start_date", { ascending: false }).limit(400) : none,
    can("medical_records") ? session.supabase.from("lab_results").select("*").eq("owner_id", ownerId).gte("test_date", addDays(today, -Math.max(days, 365))).order("test_date", { ascending: false }).limit(400) : none,
    can("medicines") ? session.supabase.from("medicines").select("*").eq("owner_id", ownerId).eq("active", true).order("name") : none,
    can("medicines") ? session.supabase.from("medicine_doses").select("*").eq("owner_id", ownerId).gte("scheduled_date", from).limit(5000) : none,
    can("supplements") ? session.supabase.from("supplements").select("*").eq("owner_id", ownerId).eq("active", true).order("sort") : none,
    can("body_recomp") ? session.supabase.from("body_metrics").select("*").eq("owner_id", ownerId).gte("measured_at", `${from}T00:00:00Z`).order("measured_at") : none,
    can("checkin") ? session.supabase.from("daily_checkins").select("*").eq("owner_id", ownerId).gte("checkin_date", from) : none,
    can("wearables") ? session.supabase.from("wearable_daily").select("*").eq("owner_id", ownerId).gte("day", from) : none,
  ]);

  const profile = prof.data as MedicalProfile | null;
  const allEvents = (events.data ?? []) as MedicalEvent[];
  const medicines = (meds.data ?? []) as Medicine[];
  const doseRows = (doses.data ?? []) as MedicineDose[];
  const periodDays = lastNDays(today, days);
  const allLabs = (labs.data ?? []) as LabResult[];

  let bladder: (ReturnType<typeof bladderSummary> & { triggers: { label: string; value: number }[] }) | null = null;
  if (can("bladder_diary")) {
    const d = await loadDiary(session, ownerId, Math.min(days, 90));
    const s = bladderSummary(dailyStats(d.days, d.events, d.fluids, d.tz), d.events, d.tz);
    bladder = s ? { ...s, triggers: triggerCounts(d.events).slice(0, 4) } : null;
  }

  const checks = medicines.length ? await medicineChecksFor(session, ownerId) : null;

  return {
    today,
    from,
    days,
    person: session.members.find((m) => m.user_id === ownerId)?.display_name ?? "",
    profile,
    age: ageOn(profile?.date_of_birth ?? null, today),
    allergies: allEvents.filter((e) => e.category === "allergy"),
    conditions: allEvents.filter((e) => e.category === "condition" && (e.ongoing || !e.end_date || e.end_date >= from)),
    timeline: allEvents.filter((e) => !["allergy", "condition"].includes(e.category) && (e.start_date >= from || e.ongoing || (e.end_date ?? "") >= from)).slice(0, 40),
    medicines: medicines.map((m) => ({ m, label: doseLabel(m), adherence: m.times.length ? adherence([m], doseRows, periodDays.filter((d) => d >= m.start_date)).pct : null })),
    supplements: (supps.data ?? []) as Supplement[],
    flags: (checks?.findings ?? []).filter((f) => f.severity !== "info"),
    labsInPeriod: allLabs.filter((l) => l.test_date >= from),
    olderAbnormal: allLabs.filter((l) => l.test_date < from && l.flag && l.flag !== "normal").slice(0, 15),
    vitals: vitalsSummary((metrics.data ?? []) as BodyMetric[], profile?.height_cm ?? null),
    bladder,
    wellbeing: wellbeingSummary((checkins.data ?? []) as DailyCheckin[], (wear.data ?? []) as WearableDay[]),
  };
}

export type VisitData = Awaited<ReturnType<typeof loadVisitData>>;

/** Plain-text version for the AI summary (no names of other people, no IDs). */
export function visitDataText(v: VisitData, reason: string) {
  const L: string[] = [];
  L.push(`Visit reason: ${reason || "routine review"}. Period: last ${v.days} days (${v.from} to ${v.today}).`);
  if (v.age != null || v.profile?.sex) L.push(`Age ${v.age ?? "?"}, sex ${v.profile?.sex ?? "?"}${v.profile?.blood_group ? `, blood group ${v.profile.blood_group}` : ""}.`);
  if (v.allergies.length) L.push(`Allergies: ${v.allergies.map((a) => a.title).join("; ")}`);
  if (v.conditions.length) L.push(`Conditions: ${v.conditions.map((c) => `${c.title}${c.ongoing ? " (ongoing)" : ""}`).join("; ")}`);
  if (v.medicines.length) L.push(`Medicines: ${v.medicines.map(({ m, label, adherence }) => `${m.name}${m.strength ? ` ${m.strength}` : ""} ${label}${m.reason ? ` for ${m.reason}` : ""}${adherence != null ? ` (${adherence}% doses taken)` : ""}`).join("; ")}`);
  if (v.supplements.length) L.push(`Supplements: ${v.supplements.map((s) => `${s.name}${s.dose ? ` ${s.dose}` : ""}`).join("; ")}`);
  if (v.flags.length) L.push(`Medicine check flags: ${v.flags.map((f) => f.title).join("; ")}`);
  if (v.timeline.length) L.push(`Health events in period:\n${v.timeline.map((e) => `- ${e.start_date} ${e.category}: ${e.title}${e.details ? ` — ${e.details.slice(0, 160)}` : ""}${e.severity ? ` (${e.severity})` : ""}`).join("\n")}`);
  if (v.labsInPeriod.length) L.push(`Lab results in period:\n${v.labsInPeriod.slice(0, 40).map((l) => `- ${l.test_date} ${l.marker}: ${l.value ?? l.value_text ?? ""} ${l.unit ?? ""}${l.flag && l.flag !== "normal" ? ` [${l.flag}]` : ""}`).join("\n")}`);
  if (v.olderAbnormal.length) L.push(`Older abnormal results (12 months): ${v.olderAbnormal.map((l) => `${l.marker} ${l.value ?? l.value_text} ${l.unit ?? ""} [${l.flag}] on ${l.test_date}`).join("; ")}`);
  const vt = v.vitals;
  if (vt.weight || vt.bpLatest || vt.glucoseLatest) L.push(`Vitals: ${[vt.weight ? `weight ${vt.weight} kg${vt.weightChange != null ? ` (${vt.weightChange > 0 ? "+" : ""}${vt.weightChange} kg in period)` : ""}` : "", vt.bmi ? `BMI ${vt.bmi}` : "", vt.bpLatest ? `BP latest ${vt.bpLatest}${vt.bpAverage ? `, average ${vt.bpAverage} over ${vt.bpReadings} readings` : ""}` : "", vt.glucoseLatest ? `glucose ${vt.glucoseLatest} mg/dL` : ""].filter(Boolean).join(", ")}`);
  if (v.bladder) L.push(`Bladder diary (${v.bladder.days} logged days, per day): ${v.bladder.voids} voids (${v.bladder.nightVoids} at night), ${v.bladder.leaks} leaks, ${v.bladder.urges} urgency episodes, ${v.bladder.fluidMl} ml fluids${v.bladder.triggers.length ? `; leak triggers: ${v.bladder.triggers.map((t) => `${t.label} ×${t.value}`).join(", ")}` : ""}.`);
  const w = v.wellbeing;
  if (w.sleepHours || w.mood || w.steps) L.push(`Wellbeing: ${[w.sleepHours ? `sleep ${w.sleepHours} h (${w.sleepSource})` : "", w.mood ? `mood ${w.mood}/5` : "", w.energy ? `energy ${w.energy}/5` : "", w.stress ? `stress ${w.stress}/5` : "", w.steps ? `${w.steps} steps/day` : ""].filter(Boolean).join(", ")}.`);
  return L.join("\n");
}
