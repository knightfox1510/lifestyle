import "server-only";

import type { AppSession } from "@/lib/session";
import type { BladderEvent, Medicine, MedicineDose, Supplement } from "@/lib/types";
import { addDays, lastNDays, localDate, localTime, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { buildMedicalContext } from "@/lib/ai/context";
import { COACH_SOURCES, coachFacts, factLines, type CoachFacts, type CoachSource } from "@/modules/coach/facts";
import { adherence, doseLabel } from "@/modules/medicines/logic";
import { TIMING_LABEL } from "@/modules/supplements/meta";
import { PHASE_LABEL, cycleStats, cycleStatus, periodsFrom, type CycleDay } from "@/modules/cycle/logic";

/** The sources this person's data can be included from (feature on, shared with the asker, not hidden). */
export function coachSourcesFor(session: AppSession, ownerId: string): CoachSource[] {
  return COACH_SOURCES.filter((s) => session.isModuleEnabled(s.module) && session.isShown(s.module) && session.accessTo(s.module, ownerId) !== "none").map((s) => s.key);
}

const ageFrom = (dob: string | null | undefined, today: string) => {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};

/**
 * Loads the chosen data for the coach and turns it into facts (numbers we
 * computed) plus short text sections (medicines, supplements, medical
 * history, cycle, bladder). Reads go through the asker's RLS-bound client.
 */
export async function loadCoachData(session: AppSession, ownerId: string, wanted: CoachSource[], periodDays: number) {
  const allowed = new Set(coachSourcesFor(session, ownerId));
  const inc = new Set(wanted.filter((w) => allowed.has(w)));
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const from = addDays(today, -(periodDays - 1));
  const fromIso = startOfLocalDayIso(from);
  const db = session.supabase;
  const q = <T,>(on: boolean, p: () => PromiseLike<{ data: T | null }>) => (on ? p() : Promise.resolve({ data: null as T | null }));

  const [profile, ngoals, food, metrics, bgoals, wear, workouts, checkins, meds, doses, sups, cycle, bladder] = await Promise.all([
    q(session.isModuleEnabled("medical_records") && session.accessTo("medical_records", ownerId) !== "none", () => db.from("medical_profiles").select("height_cm, sex, date_of_birth").eq("owner_id", ownerId).maybeSingle()),
    q(allowed.has("food"), () => db.from("nutrition_goals").select("calories, protein_g, carbs_g, fat_g, fiber_g, goal, diet_type, activity_level").eq("owner_id", ownerId).maybeSingle()),
    q(inc.has("food"), () => db.from("food_entries").select("eaten_at, description, calories, protein_g, carbs_g, fat_g, fiber_g").eq("owner_id", ownerId).gte("eaten_at", fromIso).limit(5000)),
    q(inc.has("body"), () => db.from("body_metrics").select("measured_at, weight_kg, waist_cm, body_fat_pct, bp_systolic, bp_diastolic, blood_glucose_mgdl, glucose_context").eq("owner_id", ownerId).gte("measured_at", fromIso).order("measured_at")),
    q(inc.has("body"), () => db.from("body_goals").select("target_weight_kg, target_date, target_body_fat_pct").eq("owner_id", ownerId).maybeSingle()),
    q(inc.has("wearables"), () => db.from("wearable_daily").select("day, steps, sleep_minutes, deep_sleep_minutes, resting_hr, hrv_ms, active_minutes, calories_burned").eq("owner_id", ownerId).gte("day", from)),
    q(inc.has("fitness"), () => db.from("workout_logs").select("performed_on, kind, title, status, duration_minutes").eq("owner_id", ownerId).gte("performed_on", from)),
    q(inc.has("checkin"), () => db.from("daily_checkins").select("checkin_date, sleep_hours, sleep_quality, mood, energy, stress").eq("owner_id", ownerId).gte("checkin_date", from)),
    q(inc.has("medicines"), () => db.from("medicines").select("*").eq("owner_id", ownerId).eq("active", true).eq("include_in_ai", true)),
    q(inc.has("medicines"), () => db.from("medicine_doses").select("*").eq("owner_id", ownerId).gte("scheduled_date", addDays(today, -14))),
    q(inc.has("supplements"), () => db.from("supplements").select("*").eq("owner_id", ownerId).eq("active", true).eq("include_in_ai", true)),
    q(inc.has("cycle"), () => db.from("cycle_days").select("day, flow, symptoms").eq("owner_id", ownerId).gte("day", addDays(today, -200))),
    q(inc.has("bladder"), () => db.from("bladder_events").select("occurred_at, kind").eq("owner_id", ownerId).gte("occurred_at", fromIso)),
  ]);

  type P = { height_cm: number | null; sex: "female" | "male" | "other" | null; date_of_birth: string | null } | null;
  const p = profile.data as P;
  const ng = ngoals.data as { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; goal: string | null; diet_type: string | null; activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active" | null } | null;

  const facts: CoachFacts = coachFacts({
    today,
    from,
    person: { heightCm: p?.height_cm ? Number(p.height_cm) : null, sex: p?.sex ?? null, age: ageFrom(p?.date_of_birth, today), activity: ng?.activity_level ?? null },
    food: inc.has("food")
      ? {
          entries: ((food.data ?? []) as { eaten_at: string; description: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null }[]).map((e) => ({
            ...e,
            day: localDate(e.eaten_at, tz),
            hour: Number(localTime(e.eaten_at, tz).slice(0, 2)),
          })),
          goals: ng,
        }
      : undefined,
    body: inc.has("body")
      ? { metrics: ((metrics.data ?? []) as { measured_at: string }[]).map((m) => ({ ...(m as never as CoachMetric), day: localDate(m.measured_at, tz) })), goals: bgoals.data as never }
      : undefined,
    wearables: inc.has("wearables") ? ((wear.data ?? []) as never) : undefined,
    workouts: inc.has("fitness") ? ((workouts.data ?? []) as { performed_on: string; kind: string; title: string; status: string; duration_minutes: number | null }[]).map((w) => ({ day: w.performed_on, kind: w.kind, title: w.title, status: w.status, minutes: w.duration_minutes })) : undefined,
    checkins: inc.has("checkin") ? ((checkins.data ?? []) as { checkin_date: string }[]).map((c) => ({ ...(c as never as CoachCheckin), day: c.checkin_date })) : undefined,
  });

  const about: string[] = [];
  if (p?.height_cm || p?.sex || p?.date_of_birth) about.push(`About them: ${[p?.sex, ageFrom(p?.date_of_birth, today) != null ? `age ${ageFrom(p?.date_of_birth, today)}` : null, p?.height_cm ? `height ${p.height_cm} cm` : null].filter(Boolean).join(", ")}.`);
  if (ng) about.push(`Nutrition settings: goal ${ng.goal ?? "?"}, diet ${ng.diet_type ?? "any"}, activity ${ng.activity_level ?? "?"}${ng.calories ? `, current targets ${ng.calories} kcal / ${ng.protein_g ?? "?"} g protein / ${ng.carbs_g ?? "?"} g carbs / ${ng.fat_g ?? "?"} g fat` : ""}.`);

  const sections: string[] = [];
  const medList = (meds.data ?? []) as Medicine[];
  if (medList.length) {
    const adh = adherence(medList, (doses.data ?? []) as MedicineDose[], lastNDays(addDays(today, -1), 13));
    sections.push(
      ["Current medicines (some affect weight, appetite, blood sugar, heart rate or sleep: take that into account):", ...medList.map((m) => `- ${m.name}${m.strength ? ` ${m.strength}` : ""}${m.ingredients ? ` [${m.ingredients}]` : ""}: ${doseLabel(m)}${m.reason ? `, for ${m.reason}` : ""}`), adh.pct !== null ? `Adherence last 2 weeks: ${adh.pct}%.` : ""].filter(Boolean).join("\n"),
    );
  }
  const supList = (sups.data ?? []) as Supplement[];
  if (supList.length) {
    sections.push(`Supplements taken: ${supList.map((s) => `${s.name}${s.dose ? ` ${s.dose}` : ""} (${TIMING_LABEL[s.timing].toLowerCase()})`).join("; ")}. Don't suggest supplements they already take; say if one is unnecessary or worth checking with a doctor.`);
  }
  if (inc.has("cycle")) {
    const periods = periodsFrom(((cycle.data ?? []) as CycleDay[]).sort((a, b) => a.day.localeCompare(b.day)));
    if (periods.length) {
      const st = cycleStatus(periods, today);
      const cs = cycleStats(periods);
      sections.push(`Menstrual cycle: typical ${cs.cycle}-day cycle${st.cycleDay ? `, today is day ${st.cycleDay}${st.phase ? ` (${PHASE_LABEL[st.phase].toLowerCase()})` : ""}` : ""}. Water retention before and during a period can add 0.5–2 kg on the scale; don't read that as fat gain.`);
    }
  }
  if (inc.has("bladder")) {
    const ev = (bladder.data ?? []) as Pick<BladderEvent, "occurred_at" | "kind">[];
    const leaks = ev.filter((e) => e.kind === "leak").length;
    const loggedDays = new Set(ev.map((e) => localDate(e.occurred_at, tz))).size;
    if (loggedDays) sections.push(`Bladder diary (urinary incontinence): ${(leaks / loggedDays).toFixed(1)} leaks/day over ${loggedDays} logged days. Prefer pelvic-floor-friendly training (avoid lots of jumping/heavy straining at first, breathe out on effort), keep caffeine/fizzy drinks low, and don't cut fluids to lose weight.`);
  }
  let usedMedical = false;
  if (inc.has("medical")) {
    const med = await buildMedicalContext(session, ownerId);
    if (med.text) {
      sections.push(`Medical history & blood tests:\n${med.text.slice(0, 12_000)}`);
      usedMedical = true;
    }
  }

  return { facts, lines: [...about, ...factLines(facts)], sections, included: [...inc], usedHealth: usedMedical || inc.has("medicines") || inc.has("bladder") || inc.has("cycle"), today };
}

type CoachMetric = { weight_kg: number | null; waist_cm: number | null; body_fat_pct: number | null; bp_systolic: number | null; bp_diastolic: number | null; blood_glucose_mgdl: number | null; glucose_context: string | null };
type CoachCheckin = { sleep_hours: number | null; sleep_quality: number | null; mood: number | null; energy: number | null; stress: number | null };
