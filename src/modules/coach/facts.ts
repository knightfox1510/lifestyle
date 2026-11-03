/**
 * The numbers the AI coach works from (pure; unit-tested). Raw records are
 * turned into averages, trends and comparisons here, so the AI reasons about
 * facts we computed rather than adding up hundreds of rows itself, and the
 * same facts are shown on screen as "what the coach saw".
 */

export const COACH_GOALS = ["fat_loss", "weight_loss", "recomp", "muscle_gain", "maintain", "energy_sleep", "health_markers"] as const;
export type CoachGoal = (typeof COACH_GOALS)[number];
export const COACH_GOAL_LABEL: Record<CoachGoal, string> = {
  fat_loss: "Lose fat, keep muscle",
  weight_loss: "Lose weight",
  recomp: "Recomposition (lose fat, gain muscle)",
  muscle_gain: "Build muscle",
  maintain: "Maintain weight",
  energy_sleep: "More energy & better sleep",
  health_markers: "Improve health markers (sugar, BP, cholesterol)",
};

/** What can be included, and the feature each one needs. */
export const COACH_SOURCES = [
  { key: "food", module: "food_diary", label: "Food & calories" },
  { key: "body", module: "body_recomp", label: "Weight & measurements" },
  { key: "wearables", module: "wearables", label: "Wearables (steps, sleep, heart rate, HRV)" },
  { key: "fitness", module: "fitness", label: "Workouts" },
  { key: "checkin", module: "checkin", label: "Check-ins (sleep, mood, energy, stress)" },
  { key: "supplements", module: "supplements", label: "Supplements" },
  { key: "medicines", module: "medicines", label: "Medicines" },
  { key: "medical", module: "medical_records", label: "Medical history & blood tests" },
  { key: "cycle", module: "cycle", label: "Cycle" },
  { key: "bladder", module: "bladder_diary", label: "Bladder diary" },
] as const;
export type CoachSource = (typeof COACH_SOURCES)[number]["key"];

export type CoachInput = {
  today: string;
  /** First day of the period looked at. */
  from: string;
  person: { heightCm: number | null; sex: "female" | "male" | "other" | null; age: number | null; activity: "sedentary" | "light" | "moderate" | "active" | "very_active" | null };
  food?: {
    entries: { day: string; hour: number; description: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null }[];
    goals: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; goal: string | null; diet_type: string | null } | null;
  };
  body?: {
    metrics: { day: string; weight_kg: number | null; waist_cm: number | null; body_fat_pct: number | null; bp_systolic: number | null; bp_diastolic: number | null; blood_glucose_mgdl: number | null; glucose_context: string | null }[];
    goals: { target_weight_kg: number | null; target_date: string | null; target_body_fat_pct: number | null } | null;
  };
  wearables?: { day: string; steps: number | null; sleep_minutes: number | null; deep_sleep_minutes: number | null; resting_hr: number | null; hrv_ms: number | null; active_minutes: number | null; calories_burned: number | null }[];
  workouts?: { day: string; kind: string; title: string; status: string; minutes: number | null }[];
  checkins?: { day: string; sleep_hours: number | null; sleep_quality: number | null; mood: number | null; energy: number | null; stress: number | null }[];
};

type Change = { first: number; latest: number; change: number };

export type CoachFacts = {
  from: string;
  to: string;
  days: number;
  food?: {
    daysLogged: number;
    fullDays: number;
    avg: { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
    goals: { kcal: number | null; protein: number | null };
    weekdayKcal: number | null;
    weekendKcal: number | null;
    lateKcalPct: number;
    proteinPerKg: number | null;
    top: { name: string; kcal: number; times: number }[];
  };
  weight?: Change & { perWeek: number | null; perWeekPct: number | null; weighIns: number; target: number | null; weeksToTarget: number | null; bmi: number | null };
  waist?: Change;
  bodyFat?: Change;
  bp?: { systolic: number; diastolic: number; readings: number };
  fastingSugar?: { avg: number; readings: number };
  energy?: { intake: number; maintenance: number | null; burned: number | null; /** What intake would explain the weight trend (7,700 kcal per kg). */ impliedBurn: number | null; gap: number | null };
  sleep?: { avgHours: number; deepMinutes: number | null; nights: number; nightsUnder7: number; source: "wearable" | "check-in" };
  activity?: { avgSteps: number | null; activeMinutes: number | null; burned: number | null; days: number };
  heart?: { restingAvg: number | null; restingChange: number | null; hrvAvg: number | null; hrvChange: number | null };
  training?: { perWeek: number; minutesPerWeek: number; skipped: number; byKind: Record<string, number> };
  wellbeing?: { mood: number | null; energy: number | null; stress: number | null; days: number };
  sleepVsFood?: { shortSleepKcal: number; goodSleepKcal: number; shortNights: number; goodNights: number };
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const nums = <T>(rows: T[], f: (r: T) => number | null | undefined) => rows.map(f).filter((v): v is number => v != null && Number.isFinite(Number(v))).map(Number);
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Least-squares slope in units per day (needs 3+ points over 7+ days). */
export function slopePerDay(points: { day: string; value: number }[]) {
  if (points.length < 3) return null;
  const xs = points.map((p) => dayMs(p.day) / 864e5);
  if (Math.max(...xs) - Math.min(...xs) < 7) return null;
  const mx = mean(xs)!;
  const my = mean(points.map((p) => p.value))!;
  let num = 0;
  let den = 0;
  points.forEach((p, i) => {
    num += (xs[i] - mx) * (p.value - my);
    den += (xs[i] - mx) ** 2;
  });
  return den ? num / den : null;
}

/** Average of the first and second half of a series (by date), for "rising/falling". */
function halves(points: { day: string; value: number }[]) {
  if (points.length < 4) return null;
  const s = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const mid = Math.floor(s.length / 2);
  return mean(s.slice(mid).map((p) => p.value))! - mean(s.slice(0, mid).map((p) => p.value))!;
}

function change(points: { day: string; value: number }[]): Change | undefined {
  if (!points.length) return undefined;
  const s = [...points].sort((a, b) => a.day.localeCompare(b.day));
  return { first: s[0].value, latest: s.at(-1)!.value, change: r1(s.at(-1)!.value - s[0].value) };
}

/** Last reading per day. */
function perDay<T extends { day: string }>(rows: T[], f: (r: T) => number | null) {
  const m = new Map<string, number>();
  for (const r of [...rows].sort((a, b) => a.day.localeCompare(b.day))) {
    const v = f(r);
    if (v != null && Number.isFinite(Number(v))) m.set(r.day, Number(v));
  }
  return [...m].map(([day, value]) => ({ day, value }));
}

export function coachFacts(input: CoachInput): CoachFacts {
  const days = Math.round((dayMs(input.today) - dayMs(input.from)) / 864e5) + 1;
  const out: CoachFacts = { from: input.from, to: input.today, days };
  const inRange = (d: string) => d >= input.from && d <= input.today;

  // Weight first: other numbers (protein per kg, energy balance) use it.
  let latestWeight: number | null = null;
  let weightPerDay: number | null = null;
  if (input.body) {
    const m = input.body.metrics.filter((x) => inRange(x.day));
    const w = perDay(m, (x) => x.weight_kg);
    if (w.length) {
      const c = change(w)!;
      latestWeight = c.latest;
      weightPerDay = slopePerDay(w);
      const target = input.body.goals?.target_weight_kg ?? null;
      const perWeek = weightPerDay == null ? null : weightPerDay * 7;
      const toGo = target != null ? target - c.latest : null;
      out.weight = {
        ...c,
        perWeek: perWeek == null ? null : Math.round(perWeek * 100) / 100,
        perWeekPct: perWeek == null ? null : Math.round((perWeek / c.latest) * 1000) / 10,
        weighIns: w.length,
        target,
        weeksToTarget: toGo != null && perWeek && Math.sign(toGo) === Math.sign(perWeek) && Math.abs(toGo) > 0.2 ? Math.round(toGo / perWeek) : null,
        bmi: input.person.heightCm ? r1(c.latest / (input.person.heightCm / 100) ** 2) : null,
      };
    }
    out.waist = change(perDay(m, (x) => x.waist_cm));
    out.bodyFat = change(perDay(m, (x) => x.body_fat_pct));
    const bp = m.filter((x) => x.bp_systolic && x.bp_diastolic);
    if (bp.length) out.bp = { systolic: Math.round(mean(nums(bp, (x) => x.bp_systolic))!), diastolic: Math.round(mean(nums(bp, (x) => x.bp_diastolic))!), readings: bp.length };
    const fasting = nums(m.filter((x) => x.glucose_context === "fasting"), (x) => x.blood_glucose_mgdl);
    if (fasting.length) out.fastingSugar = { avg: Math.round(mean(fasting)!), readings: fasting.length };
  }

  // Food: averages over days that look fully logged (800+ kcal), so a forgotten dinner doesn't look like a deficit.
  const kcalByDay = new Map<string, number>();
  if (input.food) {
    const e = input.food.entries.filter((x) => inRange(x.day));
    const byDay = new Map<string, { kcal: number; protein: number; carbs: number; fat: number; fiber: number; late: number }>();
    for (const x of e) {
      const d = byDay.get(x.day) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, late: 0 };
      d.kcal += Number(x.calories ?? 0);
      d.protein += Number(x.protein_g ?? 0);
      d.carbs += Number(x.carbs_g ?? 0);
      d.fat += Number(x.fat_g ?? 0);
      d.fiber += Number(x.fiber_g ?? 0);
      if (x.hour >= 21) d.late += Number(x.calories ?? 0);
      byDay.set(x.day, d);
    }
    const full = [...byDay].filter(([, d]) => d.kcal >= 800);
    for (const [day, d] of full) kcalByDay.set(day, d.kcal);
    if (byDay.size) {
      const avg = (k: "kcal" | "protein" | "carbs" | "fat" | "fiber") => Math.round(mean(full.map(([, d]) => d[k])) ?? 0);
      const weekend = (d: string) => [0, 6].includes(new Date(dayMs(d)).getUTCDay());
      const wk = mean(full.filter(([d]) => !weekend(d)).map(([, d]) => d.kcal));
      const we = mean(full.filter(([d]) => weekend(d)).map(([, d]) => d.kcal));
      const totalKcal = full.reduce((a, [, d]) => a + d.kcal, 0);
      const top = new Map<string, { kcal: number; times: number }>();
      for (const x of e) {
        const name = x.description.trim().toLowerCase().slice(0, 60);
        const t = top.get(name) ?? { kcal: 0, times: 0 };
        t.kcal += Number(x.calories ?? 0);
        t.times += 1;
        top.set(name, t);
      }
      out.food = {
        daysLogged: byDay.size,
        fullDays: full.length,
        avg: { kcal: avg("kcal"), protein: avg("protein"), carbs: avg("carbs"), fat: avg("fat"), fiber: avg("fiber") },
        goals: { kcal: input.food.goals?.calories ?? null, protein: input.food.goals?.protein_g ?? null },
        weekdayKcal: wk == null ? null : Math.round(wk),
        weekendKcal: we == null ? null : Math.round(we),
        lateKcalPct: totalKcal ? Math.round((full.reduce((a, [, d]) => a + d.late, 0) / totalKcal) * 100) : 0,
        proteinPerKg: latestWeight && full.length ? r1(avg("protein") / latestWeight) : null,
        top: [...top].sort((a, b) => b[1].kcal - a[1].kcal).slice(0, 6).map(([name, t]) => ({ name, kcal: Math.round(t.kcal), times: t.times })),
      };
    }
  }

  // Wearables.
  const wear = (input.wearables ?? []).filter((x) => inRange(x.day));
  if (wear.length) {
    const steps = nums(wear, (x) => x.steps);
    const active = nums(wear, (x) => x.active_minutes);
    const burned = nums(wear, (x) => x.calories_burned).filter((v) => v > 800);
    out.activity = { avgSteps: steps.length ? Math.round(mean(steps)!) : null, activeMinutes: active.length ? Math.round(mean(active)!) : null, burned: burned.length ? Math.round(mean(burned)!) : null, days: wear.length };
    const rhr = perDay(wear, (x) => x.resting_hr);
    const hrv = perDay(wear, (x) => x.hrv_ms);
    if (rhr.length || hrv.length) {
      const h1 = halves(rhr);
      const h2 = halves(hrv);
      out.heart = { restingAvg: rhr.length ? Math.round(mean(rhr.map((p) => p.value))!) : null, restingChange: h1 == null ? null : r1(h1), hrvAvg: hrv.length ? Math.round(mean(hrv.map((p) => p.value))!) : null, hrvChange: h2 == null ? null : r1(h2) };
    }
  }

  // Sleep: the band if it has it, else check-ins.
  const wearSleep = perDay(wear, (x) => (x.sleep_minutes && x.sleep_minutes >= 120 ? x.sleep_minutes / 60 : null));
  const checks = (input.checkins ?? []).filter((x) => inRange(x.day));
  const checkSleep = perDay(checks, (x) => x.sleep_hours);
  const sleep = wearSleep.length >= 3 ? wearSleep : checkSleep;
  if (sleep.length) {
    const deep = nums(wear, (x) => x.deep_sleep_minutes).filter((v) => v > 0);
    out.sleep = { avgHours: r1(mean(sleep.map((p) => p.value))!), deepMinutes: sleep === wearSleep && deep.length ? Math.round(mean(deep)!) : null, nights: sleep.length, nightsUnder7: sleep.filter((p) => p.value < 7).length, source: sleep === wearSleep ? "wearable" : "check-in" };
    // Calories on the day after a short night vs a good one (sleep is logged on the day you wake up).
    const short = sleep.filter((p) => p.value < 6.5 && kcalByDay.has(p.day)).map((p) => kcalByDay.get(p.day)!);
    const good = sleep.filter((p) => p.value >= 7 && kcalByDay.has(p.day)).map((p) => kcalByDay.get(p.day)!);
    if (short.length >= 3 && good.length >= 3) out.sleepVsFood = { shortSleepKcal: Math.round(mean(short)!), goodSleepKcal: Math.round(mean(good)!), shortNights: short.length, goodNights: good.length };
  }
  if (checks.length) {
    const avg = (f: (x: (typeof checks)[number]) => number | null) => {
      const v = nums(checks, f);
      return v.length ? r1(mean(v)!) : null;
    };
    out.wellbeing = { mood: avg((x) => x.mood), energy: avg((x) => x.energy), stress: avg((x) => x.stress), days: checks.length };
  }

  // Workouts.
  if (input.workouts) {
    const w = input.workouts.filter((x) => inRange(x.day));
    const done = w.filter((x) => x.status === "done");
    const weeks = Math.max(1, days / 7);
    const byKind: Record<string, number> = {};
    for (const x of done) byKind[x.kind] = (byKind[x.kind] ?? 0) + 1;
    if (w.length) out.training = { perWeek: r1(done.length / weeks), minutesPerWeek: Math.round(done.reduce((a, x) => a + Number(x.minutes ?? 0), 0) / weeks), skipped: w.length - done.length, byKind };
  }

  // Energy balance: logged intake vs estimated maintenance, the band's estimate, and what the scale implies.
  if (out.food?.fullDays && out.food.fullDays >= 5) {
    const p = input.person;
    const maintenance =
      latestWeight && p.heightCm && p.age
        ? Math.round(((10 * latestWeight + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : p.sex === "female" ? -161 : -78)) * { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[p.activity ?? "light"]) / 10) * 10
        : null;
    const intake = out.food.avg.kcal;
    // 1 kg of body weight change ≈ 7,700 kcal. Losing 0.5 kg/week means burning ~550 kcal/day more than eaten.
    const impliedBurn = weightPerDay != null && out.weight && out.weight.weighIns >= 4 ? Math.round(intake - weightPerDay * 7700) : null;
    out.energy = { intake, maintenance, burned: out.activity?.burned ?? null, impliedBurn, gap: impliedBurn != null && maintenance ? impliedBurn - maintenance : null };
  }

  return out;
}

const signed = (n: number, unit = "") => `${n > 0 ? "+" : ""}${n}${unit}`;

/** The facts as plain lines for the AI prompt. */
export function factLines(f: CoachFacts): string[] {
  const L: string[] = [`Period: ${f.from} to ${f.to} (${f.days} days).`];
  if (f.weight) {
    const w = f.weight;
    L.push(
      `Weight: ${w.first} → ${w.latest} kg (${signed(w.change, " kg")}, ${w.weighIns} weigh-ins)${w.perWeek != null ? `; trend ${signed(w.perWeek, " kg/week")} (${signed(w.perWeekPct!, "% of body weight/week")})` : "; too few weigh-ins for a trend"}${w.bmi ? `; BMI ${w.bmi} (Indian cut-offs: 23 overweight, 25 obese)` : ""}${w.target != null ? `; target ${w.target} kg${w.weeksToTarget ? `, ~${w.weeksToTarget} weeks away at this rate` : ""}` : ""}.`,
    );
  }
  if (f.waist) L.push(`Waist: ${f.waist.first} → ${f.waist.latest} cm (${signed(f.waist.change, " cm")}).`);
  if (f.bodyFat) L.push(`Body fat: ${f.bodyFat.first} → ${f.bodyFat.latest}% (${signed(f.bodyFat.change, " points")}).`);
  if (f.bp) L.push(`Blood pressure: average ${f.bp.systolic}/${f.bp.diastolic} over ${f.bp.readings} readings.`);
  if (f.fastingSugar) L.push(`Fasting blood sugar: average ${f.fastingSugar.avg} mg/dL over ${f.fastingSugar.readings} readings.`);
  if (f.food) {
    const x = f.food;
    L.push(
      `Food: ${x.daysLogged} days logged, ${x.fullDays} look complete (800+ kcal; averages use these). Average ${x.avg.kcal} kcal, protein ${x.avg.protein} g${x.proteinPerKg ? ` (${x.proteinPerKg} g/kg)` : ""}, carbs ${x.avg.carbs} g, fat ${x.avg.fat} g, fibre ${x.avg.fiber} g.${x.goals.kcal ? ` Goal ${x.goals.kcal} kcal${x.goals.protein ? `, ${x.goals.protein} g protein` : ""}.` : ""}`,
      `Weekdays ${x.weekdayKcal ?? "?"} kcal vs weekends ${x.weekendKcal ?? "?"} kcal. ${x.lateKcalPct}% of calories eaten after 9 pm.`,
      `Biggest calorie sources over the period: ${x.top.map((t) => `${t.name} (${t.times}×, ~${Math.round(t.kcal / t.times)} kcal each time)`).join(", ")}.`,
    );
  }
  if (f.energy) {
    const e = f.energy;
    L.push(
      `Energy balance: logged intake ${e.intake} kcal/day; estimated maintenance (Mifflin–St Jeor × activity) ${e.maintenance ?? "unknown"}; band's calories burned ${e.burned ?? "n/a"}.${e.impliedBurn != null ? ` The weight trend implies the body actually burns ~${e.impliedBurn} kcal/day vs what's logged${e.gap != null ? ` (${signed(e.gap)} vs the estimate: a big negative gap usually means meals, oil, snacks or drinks are missed in the log; a positive one means more activity than assumed)` : ""}.` : ""}`,
    );
  }
  if (f.sleep) L.push(`Sleep (${f.sleep.source}): average ${f.sleep.avgHours} h over ${f.sleep.nights} nights, ${f.sleep.nightsUnder7} under 7 h${f.sleep.deepMinutes ? `, deep sleep ~${f.sleep.deepMinutes} min` : ""}.`);
  if (f.sleepVsFood) L.push(`After nights under 6.5 h they ate ${f.sleepVsFood.shortSleepKcal} kcal vs ${f.sleepVsFood.goodSleepKcal} kcal after 7 h+ (${f.sleepVsFood.shortNights} vs ${f.sleepVsFood.goodNights} days).`);
  if (f.activity) L.push(`Activity: ${f.activity.avgSteps != null ? `${f.activity.avgSteps} steps/day` : "no steps"}${f.activity.activeMinutes != null ? `, ${f.activity.activeMinutes} active min/day` : ""} (${f.activity.days} days of band data).`);
  if (f.heart) L.push(`Heart: resting ${f.heart.restingAvg ?? "?"} bpm${f.heart.restingChange != null ? ` (${signed(f.heart.restingChange)} second half vs first)` : ""}; HRV ${f.heart.hrvAvg ?? "n/a"} ms${f.heart.hrvChange != null ? ` (${signed(f.heart.hrvChange)})` : ""}. Rising resting HR or falling HRV can mean poor recovery, illness, stress or too big a deficit.`);
  if (f.training) L.push(`Workouts: ${f.training.perWeek}/week, ${f.training.minutesPerWeek} min/week (${Object.entries(f.training.byKind).map(([k, n]) => `${k} ${n}`).join(", ") || "none done"}), ${f.training.skipped} skipped.`);
  if (f.wellbeing) L.push(`Check-ins (1–5): mood ${f.wellbeing.mood ?? "?"}, energy ${f.wellbeing.energy ?? "?"}, stress ${f.wellbeing.stress ?? "?"} over ${f.wellbeing.days} days.`);
  return L;
}
