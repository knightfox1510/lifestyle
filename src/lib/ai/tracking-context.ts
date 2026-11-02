import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, lastNDays, startOfLocalDayIso, todayIn } from "@/lib/dates";
import type { BladderEvent, BodyGoals, BodyMetric, DailyCheckin, FluidIntake, FoodEntry, Habit, HabitLog, Medicine, MedicineDose, NutritionGoals, PelvicFloorSession, Supplement } from "@/lib/types";
import { localDate } from "@/lib/dates";
import { totals } from "@/modules/food/meta";
import { MICRO_KEYS, NUTRIENT_META, dailyTargets, formatNutrient, fromEntry as nutrientsFromEntry, sum as sumNutrients } from "@/modules/nutrition/nutrients";
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

  const [meds, doses, sups, events, fluids, kegel, checkins, habits, habitLogs, food, nGoals, body, bGoals, workouts, classes, wear] = await Promise.all([
    can("medicines") ? db.from("medicines").select("*").eq("owner_id", subjectId).eq("active", true).eq("include_in_ai", true) : null,
    can("medicines") ? db.from("medicine_doses").select("*").eq("owner_id", subjectId).gte("scheduled_date", days14[0]) : null,
    can("supplements") ? db.from("supplements").select("*").eq("owner_id", subjectId).eq("active", true).eq("include_in_ai", true) : null,
    can("bladder_diary") ? db.from("bladder_events").select("*").eq("owner_id", subjectId).gte("occurred_at", from14) : null,
    can("bladder_diary") ? db.from("fluid_intake").select("*").eq("owner_id", subjectId).gte("occurred_at", from14) : null,
    can("pelvic_floor") ? db.from("pelvic_floor_sessions").select("*").eq("owner_id", subjectId).gte("performed_at", from14) : null,
    can("checkin") ? db.from("daily_checkins").select("*").eq("owner_id", subjectId).gte("checkin_date", addDays(today, -6)) : null,
    can("habits") ? db.from("habits").select("*").eq("owner_id", subjectId).eq("active", true) : null,
    can("habits") ? db.from("habit_logs").select("*").eq("owner_id", subjectId).gte("log_date", addDays(today, -6)) : null,
    can("food_diary") ? db.from("food_entries").select("eaten_at, description, calories, protein_g, carbs_g, fat_g, fiber_g, source, micros, accuracy, irritants").eq("owner_id", subjectId).gte("eaten_at", startOfLocalDayIso(addDays(today, -6))) : null,
    can("food_diary") ? db.from("nutrition_goals").select("*").eq("owner_id", subjectId).maybeSingle() : null,
    can("body_recomp") ? db.from("body_metrics").select("*").eq("owner_id", subjectId).gte("measured_at", startOfLocalDayIso(addDays(today, -60))).order("measured_at") : null,
    can("body_recomp") ? db.from("body_goals").select("*").eq("owner_id", subjectId).maybeSingle() : null,
    can("fitness") ? db.from("workout_logs").select("performed_on, kind, title, status, duration_minutes").eq("owner_id", subjectId).gte("performed_on", days14[0]) : null,
    can("fitness") ? db.from("fitness_classes").select("name, kind, days_of_week, start_time").eq("owner_id", subjectId).eq("active", true) : null,
    can("wearables") ? db.from("wearable_daily").select("day, steps, sleep_minutes, deep_sleep_minutes, resting_hr").eq("owner_id", subjectId).gte("day", addDays(today, -6)) : null,
  ]);

  const medList = (meds?.data ?? []) as Medicine[];
  if (medList.length) {
    const doseList = (doses?.data ?? []) as MedicineDose[];
    const adh = adherence(medList, doseList, lastNDays(addDays(today, -1), 13));
    lines.push(
      "Current medicines (tracked):",
      ...medList.map(
        (m) =>
          `- ${m.name}${m.strength ? ` ${m.strength}` : ""}${m.ingredients ? ` [${m.ingredients}]` : ""}: ${doseLabel(m)} ${m.times.length ? `at ${m.times.join(", ")}` : "as needed"}${m.reason ? `, for ${m.reason}` : ""}${m.instructions ? ` (${m.instructions})` : ""}`,
      ),
    );
    if (adh.pct !== null) lines.push(`Medicine adherence last 2 weeks: ${adh.pct}%.`);
  }

  const supList = (sups?.data ?? []) as Supplement[];
  if (supList.length) {
    lines.push("", `Daily supplements: ${supList.map((s) => {
      const n = Object.entries(s.nutrients ?? {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k.replace(/_(mg|mcg|g)$/, "")} ${v}${k.match(/_(mg|mcg|g)$/)?.[1] ?? ""}`);
      return `${s.name}${s.dose ? ` ${s.dose}` : ""} (${TIMING_LABEL[s.timing].toLowerCase()}${n.length ? `; per dose: ${n.join(", ")}` : ""})`;
    }).join("; ")}. Count these toward vitamin/mineral needs; don't push foods or extra supplements for nutrients already covered.`);
  }

  const ev = (events?.data ?? []) as BladderEvent[];
  const fl = (fluids?.data ?? []) as FluidIntake[];
  if (ev.length || fl.length) {
    const stats = dailyStats(days14, ev, fl, tz, (kegel?.data ?? []) as PelvicFloorSession[], (workouts?.data ?? []) as { performed_on: string; kind: string; status: string }[]);
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

  const wl = (workouts?.data ?? []) as { performed_on: string; kind: string; title: string; status: string; duration_minutes: number | null }[];
  const cl = (classes?.data ?? []) as { name: string; kind: string; days_of_week: number[]; start_time: string }[];
  if (wl.length || cl.length) {
    const doneW = wl.filter((w) => w.status === "done");
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    lines.push(
      "",
      `Exercise: ${cl.length ? `scheduled ${cl.map((c) => `${c.name} (${c.kind}, ${c.days_of_week.map((d) => DAYS[d]).join("/")} ${c.start_time})`).join("; ")}. ` : ""}Last 14 days: ${doneW.length} sessions, ${doneW.reduce((a, w) => a + (w.duration_minutes ?? 0), 0)} min (${[...new Set(doneW.map((w) => w.kind))].join(", ") || "none"}), ${wl.filter((w) => w.status === "skipped").length} skipped.`,
    );
  }

  const wd = (wear?.data ?? []) as { day: string; steps: number | null; sleep_minutes: number | null; deep_sleep_minutes: number | null; resting_hr: number | null }[];
  if (wd.length) {
    const mean = (k: "steps" | "sleep_minutes" | "resting_hr") => {
      const v = wd.map((r) => r[k]).filter((x): x is number => x !== null);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };
    const sleep = mean("sleep_minutes");
    lines.push("", `Wearable, last 7 days (${wd.length} days): avg ${mean("steps") ?? "?"} steps/day, ${sleep ? `${Math.floor(sleep / 60)}h ${sleep % 60}m sleep` : "sleep n/a"}, resting HR ${mean("resting_hr") ?? "n/a"}.`);
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

  const ng = (nGoals?.data ?? null) as NutritionGoals | null;
  const fe = (food?.data ?? []) as Pick<FoodEntry, "eaten_at" | "description" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "source" | "micros" | "accuracy" | "irritants">[];
  if (ng || fe.length) {
    if (ng) {
      lines.push("", `Nutrition: goal ${ng.goal}, diet ${ng.diet_type}, activity ${ng.activity_level}${ng.calories ? `; targets ${ng.calories} kcal, ${ng.protein_g ?? "?"} g protein, ${ng.fiber_g ?? "?"} g fibre` : ""}${ng.dislikes ? `; avoids ${ng.dislikes}` : ""}.`);
    }
    if (fe.length) {
      const days = lastNDays(today, 7).map((d) => totals(fe.filter((e) => localDate(e.eaten_at, tz) === d))).filter((t) => t.calories > 0);
      const avg = (k: "calories" | "protein_g" | "fiber_g") => Math.round(days.reduce((a, t) => a + t[k], 0) / Math.max(1, days.length));
      const todayT = totals(fe.filter((e) => localDate(e.eaten_at, tz) === today));
      lines.push(`Food diary last 7 days (${days.length} days logged): avg ${avg("calories")} kcal, ${avg("protein_g")} g protein, ${avg("fiber_g")} g fibre per day. Today so far: ${todayT.calories} kcal, ${todayT.protein_g} g protein.`);
      const withData = fe.filter((e) => e.accuracy && e.accuracy !== "estimated");
      if (withData.length >= 3) {
        const loggedDays = Math.max(1, new Set(fe.map((e) => localDate(e.eaten_at, tz))).size);
        const tot = sumNutrients(fe.map((e) => nutrientsFromEntry({ ...e, micros: e.micros ?? {} })));
        const targets = dailyTargets(null, ng?.calories ?? null);
        const parts = MICRO_KEYS.filter((k) => tot[k] !== undefined && targets[k]).map((k) => {
          const v = (tot[k] ?? 0) / loggedDays;
          const t = targets[k]!;
          const flag = t.kind === "min" ? (v < t.amount * 0.6 ? " LOW" : "") : v > t.amount ? " HIGH" : "";
          return `${NUTRIENT_META[k].label} ${formatNutrient(k, v)}${flag}`;
        });
        if (parts.length) lines.push(`Micronutrients, 7-day daily average (${withData.length}/${fe.length} items with full data, so partial): ${parts.join(", ")}.`);
      }
      const irr = [...new Set(fe.flatMap((e) => e.irritants ?? []))];
      if (irr.length) lines.push(`Bladder irritants eaten this week: ${irr.join(", ")}.`);
      const eatenOut = fe.filter((e) => e.source === "restaurant");
      if (eatenOut.length) {
        const outDays = new Set(eatenOut.map((e) => localDate(e.eaten_at, tz))).size;
        lines.push(`Restaurant/takeout meals in the last 7 days: ${eatenOut.length} items on ${outDays} day${outDays === 1 ? "" : "s"} (${eatenOut.slice(0, 5).map((e) => e.description).join("; ")}).`);
      }
    }
  }

  const bm = (body?.data ?? []) as BodyMetric[];
  const bg = (bGoals?.data ?? null) as BodyGoals | null;
  const w = bm.filter((m) => m.weight_kg !== null);
  if (w.length || bg) {
    const latest = w.at(-1);
    const first = w[0];
    lines.push(
      "",
      `Body: ${latest ? `weight ${latest.weight_kg} kg (${localDate(latest.measured_at, tz)})` : "no recent weigh-in"}${first && latest && first !== latest ? `, ${Math.round((Number(latest.weight_kg) - Number(first.weight_kg)) * 10) / 10} kg since ${localDate(first.measured_at, tz)}` : ""}${bg?.target_weight_kg ? `; target ${bg.target_weight_kg} kg${bg.target_date ? ` by ${bg.target_date}` : ""}` : ""}.`,
    );
    const bp = [...bm].reverse().find((m) => m.bp_systolic);
    const gl = [...bm].reverse().find((m) => m.blood_glucose_mgdl);
    if (bp || gl) lines.push(`Latest vitals: ${[bp ? `BP ${bp.bp_systolic}/${bp.bp_diastolic}` : null, gl ? `glucose ${gl.blood_glucose_mgdl} mg/dL (${gl.glucose_context ?? "random"})` : null].filter(Boolean).join(", ")}.`);
  }

  return lines.join("\n").trim();
}
