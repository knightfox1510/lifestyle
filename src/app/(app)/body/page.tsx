import { getSession } from "@/lib/session";
import { addDays, dayOfWeek, lastNDays, localDate, localTime, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card, EmptyState, cx } from "@/components/ui";
import { LineChart } from "@/components/charts";
import type { BodyGoals, BodyMetric, FoodEntry, MedicalProfile, NutritionGoals } from "@/lib/types";
import { BMI_LABEL, ageOn, bmi, bmiBand, bmr, healthyWeightRange, proteinRange, waistRisk, waistToHeight } from "@/modules/body/stats";
import { maintenanceCalories } from "@/modules/food/meta";
import { totals } from "@/modules/food/meta";
import { BodyBasicsForm, BodyGoalsForm, WeightForm } from "./forms";
import { deleteBodyMetric, updateBodyMetric } from "./actions";
import { EditRecord, type EditField } from "@/components/edit-record";

const BODY_FIELDS: EditField[] = [
  { name: "when", label: "Date & time", type: "datetime-local" },
  { name: "weight_kg", label: "Weight (kg)", type: "number", min: 20, max: 350 },
  { name: "body_fat_pct", label: "Body fat %", type: "number", min: 2, max: 75 },
  { name: "waist_cm", label: "Waist (cm)", type: "number" },
  { name: "hip_cm", label: "Hip (cm)", type: "number" },
  { name: "chest_cm", label: "Chest (cm)", type: "number" },
  { name: "arm_cm", label: "Arm (cm)", type: "number" },
  { name: "thigh_cm", label: "Thigh (cm)", type: "number" },
  { name: "resting_hr", label: "Resting heart rate", type: "number", step: 1 },
  { name: "bp_systolic", label: "BP systolic", type: "number", step: 1 },
  { name: "bp_diastolic", label: "BP diastolic", type: "number", step: 1 },
  { name: "blood_glucose_mgdl", label: "Blood sugar (mg/dL)", type: "number", step: 1 },
  { name: "glucose_context", label: "Sugar taken", type: "select", allowEmpty: true, options: [{ value: "fasting", label: "Fasting" }, { value: "post_meal", label: "After a meal" }, { value: "random", label: "Random" }] },
  { name: "notes", label: "Notes", type: "textarea", maxLength: 500 },
];

export const metadata = { title: "Body recomposition" };

export default async function BodyPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const canWrite = session.accessTo("body_recomp", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  const foodVisible = session.isModuleEnabled("food_diary") && session.accessTo("food_diary", ownerId) !== "none";
  const from = startOfLocalDayIso(addDays(today, -180));

  const medicalOn = session.isModuleEnabled("medical_records") && session.accessTo("medical_records", ownerId) !== "none";
  const [{ data: m }, { data: g }, food, ng, mp] = await Promise.all([
    session.supabase.from("body_metrics").select("*").eq("owner_id", ownerId).gte("measured_at", from).order("measured_at"),
    session.supabase.from("body_goals").select("*").eq("owner_id", ownerId).maybeSingle(),
    foodVisible
      ? session.supabase.from("food_entries").select("eaten_at, calories, protein_g, carbs_g, fat_g, fiber_g").eq("owner_id", ownerId).gte("eaten_at", startOfLocalDayIso(addDays(today, -42)))
      : Promise.resolve({ data: [] }),
    foodVisible ? session.supabase.from("nutrition_goals").select("calories, activity_level").eq("owner_id", ownerId).maybeSingle() : Promise.resolve({ data: null }),
    medicalOn ? session.supabase.from("medical_profiles").select("height_cm, sex, date_of_birth").eq("owner_id", ownerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const profile = mp.data as Pick<MedicalProfile, "height_cm" | "sex" | "date_of_birth"> | null;
  const metrics = (m ?? []) as BodyMetric[];
  const goals = g as BodyGoals | null;
  const weights = metrics.filter((x) => x.weight_kg !== null).map((x) => ({ date: localDate(x.measured_at, tz), value: Number(x.weight_kg) }));
  // One point per day (last reading wins).
  const byDay = new Map(weights.map((w) => [w.date, w.value]));
  const daily = [...byDay.entries()].map(([date, value]) => ({ date, value }));
  const latest = daily.at(-1)?.value ?? null;
  const weekAgo = daily.filter((d) => d.date <= addDays(today, -7)).at(-1)?.value ?? null;
  const monthAgo = daily.filter((d) => d.date <= addDays(today, -30)).at(-1)?.value ?? null;
  const target = goals?.target_weight_kg != null ? Number(goals.target_weight_kg) : null;
  const start = goals?.start_weight_kg != null ? Number(goals.start_weight_kg) : daily[0]?.value ?? null;
  const progress = latest !== null && target !== null && start !== null && start !== target ? Math.max(0, Math.min(100, ((start - latest) / (start - target)) * 100)) : null;

  // Weekly (Mon–Sun) average intake vs weight change.
  const entries = ((food.data ?? []) as Pick<FoodEntry, "eaten_at" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g">[]);
  const weekStart = (d: string) => addDays(d, -((dayOfWeek(d) + 6) % 7));
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(weekStart(today), -7 * (5 - i)));
  const weekRows = weeks.map((ws) => {
    const days = lastNDays(addDays(ws, 6), 7).filter((d) => d <= today);
    const dayTotals = days.map((d) => totals(entries.filter((e) => localDate(e.eaten_at, tz) === d)).calories).filter((c) => c > 0);
    const w = daily.filter((x) => x.date >= ws && x.date <= addDays(ws, 6)).map((x) => x.value);
    return {
      ws,
      avgKcal: dayTotals.length ? Math.round(dayTotals.reduce((a, b) => a + b, 0) / dayTotals.length) : null,
      loggedDays: dayTotals.length,
      avgWeight: w.length ? Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10 : null,
    };
  });
  const kcalGoal = (ng.data as Pick<NutritionGoals, "calories"> | null)?.calories ?? null;
  const delta = (a: number | null) => (latest !== null && a !== null ? Math.round((latest - a) * 10) / 10 : null);
  const fmtDelta = (d: number | null) => (d === null ? "–" : `${d > 0 ? "+" : ""}${d} kg`);

  // Body numbers from height (medical profile), latest weight and waist.
  const height = profile?.height_cm != null ? Number(profile.height_cm) : null;
  const age = profile?.date_of_birth ? ageOn(profile.date_of_birth, today) : null;
  const sex = profile?.sex ?? null;
  const waist = [...metrics].reverse().find((x) => x.waist_cm != null)?.waist_cm ?? null;
  const bmiNow = latest !== null && height ? bmi(latest, height) : null;
  const band = bmiNow !== null ? bmiBand(bmiNow) : null;
  const range = height ? healthyWeightRange(height) : null;
  const whtr = waist !== null && height ? waistToHeight(Number(waist), height) : null;
  const waistHigh = waist !== null ? waistRisk(Number(waist), sex) : null;
  const activity = (ng.data as Pick<NutritionGoals, "activity_level"> | null)?.activity_level ?? "moderate";
  const bmrNow = latest !== null && height && age ? bmr(latest, height, age, sex) : null;
  const maintenance = latest !== null && height && age ? maintenanceCalories({ weightKg: latest, heightCm: height, age, sex, activity }) : null;
  const protein = latest !== null ? proteinRange(latest) : null;

  return (
    <div className="space-y-4">
      {canWrite ? <WeightForm ownerId={ownerId} last={latest} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">Current</p>
          <p className="text-2xl font-semibold tabular-nums">{latest ?? "–"}<span className="text-sm font-normal text-fg-muted"> kg</span></p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">7 days</p>
          <p className="text-2xl font-semibold tabular-nums">{fmtDelta(delta(weekAgo))}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">30 days</p>
          <p className="text-2xl font-semibold tabular-nums">{fmtDelta(delta(monthAgo))}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-xs text-fg-muted">To target</p>
          <p className="text-2xl font-semibold tabular-nums">{latest !== null && target !== null ? `${Math.round(Math.abs(latest - target) * 10) / 10} kg` : "–"}</p>
          {target !== null ? <p className="text-xs text-fg-muted">target {target} kg{goals?.target_date ? ` by ${shortDate(goals.target_date)}` : ""}</p> : null}
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Your body numbers</h2>
          {medicalOn && canWrite && height ? <BodyBasicsForm ownerId={ownerId} height={height} need={{ height: false, sex: !sex, dob: !age }} /> : null}
        </div>
        {!height ? (
          medicalOn && canWrite ? (
            <div className="space-y-2">
              <p className="text-sm text-fg-muted">Add height to see BMI, a healthy weight range for your height and daily calorie needs.</p>
              <BodyBasicsForm ownerId={ownerId} height={null} need={{ height: true, sex: !sex, dob: !age }} />
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Height is kept in the medical profile{medicalOn ? "" : " (turn on Medical records in Settings → Household)"}.</p>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-fg-muted">BMI</p>
              <p className={cx("text-2xl font-semibold tabular-nums", band === "obese" && "text-danger", band === "over" && "text-sun")}>{bmiNow ?? "–"}</p>
              {band ? <p className="text-xs text-fg-muted">{BMI_LABEL[band]}</p> : <p className="text-xs text-fg-muted">log a weight</p>}
            </div>
            <div>
              <p className="text-xs text-fg-muted">Healthy weight for {height} cm</p>
              <p className="text-2xl font-semibold tabular-nums">{range ? `${Math.round(range.low)}–${Math.round(range.high)}` : "–"}<span className="text-sm font-normal text-fg-muted"> kg</span></p>
              <p className="text-xs text-fg-muted">BMI 18.5–22.9</p>
            </div>
            <div>
              <p className="text-xs text-fg-muted">Waist ÷ height</p>
              <p className={cx("text-2xl font-semibold tabular-nums", whtr?.band === "high" && "text-danger", whtr?.band === "raised" && "text-sun")}>{whtr ? whtr.value.toFixed(2) : "–"}</p>
              <p className="text-xs text-fg-muted">{whtr ? (whtr.band === "ok" ? "under 0.5 · good" : whtr.band === "raised" ? "aim for under 0.5" : "high · aim for under 0.5") : "log a waist measurement"}{waistHigh ? " · waist above the Indian cut-off" : ""}</p>
            </div>
            <div>
              <p className="text-xs text-fg-muted">Calories to maintain</p>
              <p className="text-2xl font-semibold tabular-nums">{maintenance ? `~${maintenance.toLocaleString("en-IN")}` : "–"}</p>
              <p className="text-xs text-fg-muted">{bmrNow ? `at rest ${bmrNow.toLocaleString("en-IN")} · ${activity.replace("_", " ")}` : "needs age and sex"}</p>
            </div>
          </div>
        )}
        {protein ? <p className="text-xs text-fg-muted">Protein: at least {protein.rda} g a day (0.8 g/kg); {protein.active[0]}–{protein.active[1]} g when losing fat or strength training.</p> : null}
        <p className="text-xs text-fg-muted">BMI uses the cut-offs for Indian adults (overweight from 23). It doesn&apos;t see muscle, so waist ÷ height is often the better guide. Not a diagnosis.</p>
      </Card>

      {progress !== null ? (
        <Card className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Progress to {target} kg</span>
            <span className="tabular-nums text-fg-muted">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          {goals?.milestones.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {goals.milestones.map((ms) => {
                const reached = latest !== null && start !== null && (start > (target ?? 0) ? latest <= ms : latest >= ms);
                const firstHit = daily.find((d) => (start! > (target ?? 0) ? d.value <= ms : d.value >= ms));
                return (
                  <li key={ms} className={cx("rounded-full border px-2.5 py-1 text-xs", reached ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
                    {reached ? "🏁 " : ""}{ms} kg{reached && firstHit ? ` · ${shortDate(firstHit.date)}` : ""}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {canWrite ? <BodyGoalsForm ownerId={ownerId} goals={goals} current={latest} /> : null}

      {daily.length ? (
        <Card>
          <LineChart
            title="Weight"
            subtitle="Last 6 months"
            points={daily.map((d) => ({ date: d.date, value: d.value, label: shortDate(d.date), tooltip: `${shortDate(d.date)}: ${d.value} kg` }))}
            unit=" kg"
            target={target}
            targetLabel={target !== null ? `Target ${target} kg` : undefined}
          />
        </Card>
      ) : (
        <EmptyState title="No weigh-ins yet">Log your weight a few times a week (same time of day) for a reliable trend.</EmptyState>
      )}

      {foodVisible ? (
        <Card className="overflow-x-auto">
          <h2 className="mb-1 text-sm font-semibold">Calories vs. weight, by week</h2>
          <p className="mb-2 text-xs text-fg-muted">Average daily intake on logged days, next to average weight. A steady deficit should show as a slow downward weight trend.</p>
          <table className="w-full min-w-[420px] text-sm tabular-nums">
            <thead className="text-xs text-fg-muted">
              <tr>
                <th className="text-left font-medium">Week of</th>
                <th className="text-right font-medium">Avg kcal/day</th>
                <th className="text-right font-medium">Days logged</th>
                <th className="text-right font-medium">Avg weight</th>
                <th className="text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {weekRows.map((w, i) => {
                const prev = weekRows[i - 1]?.avgWeight ?? null;
                const ch = prev !== null && w.avgWeight !== null ? Math.round((w.avgWeight - prev) * 10) / 10 : null;
                return (
                  <tr key={w.ws} className="border-t border-border">
                    <td className="py-1.5 text-left">{shortDate(w.ws)}</td>
                    <td className={cx("text-right", Boolean(kcalGoal && w.avgKcal && w.avgKcal > kcalGoal * 1.05) && "text-danger")}>{w.avgKcal ?? "–"}{kcalGoal && w.avgKcal ? <span className="text-xs text-fg-muted"> / {kcalGoal}</span> : null}</td>
                    <td className="text-right text-fg-muted">{w.loggedDays}</td>
                    <td className="text-right">{w.avgWeight ?? "–"}</td>
                    <td className="text-right">{ch === null ? "–" : `${ch > 0 ? "+" : ""}${ch}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}

      {metrics.some((x) => x.waist_cm || x.hip_cm || x.body_fat_pct) ? (
        <Card className="overflow-x-auto">
          <h2 className="mb-2 text-sm font-semibold">Measurements</h2>
          <table className="w-full min-w-[480px] text-sm tabular-nums">
            <thead className="text-xs text-fg-muted">
              <tr><th className="text-left font-medium">Date</th><th className="text-right font-medium">Body fat</th><th className="text-right font-medium">Waist</th><th className="text-right font-medium">Hip</th><th className="text-right font-medium">Chest</th><th className="text-right font-medium">Arm</th><th className="text-right font-medium">Thigh</th><th /></tr>
            </thead>
            <tbody>
              {[...metrics].reverse().filter((x) => x.waist_cm || x.hip_cm || x.body_fat_pct || x.chest_cm || x.arm_cm || x.thigh_cm).slice(0, 12).map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="py-1.5 text-left">{shortDate(localDate(x.measured_at, tz))}</td>
                  <td className="text-right">{x.body_fat_pct ? `${x.body_fat_pct}%` : "–"}</td>
                  <td className="text-right">{x.waist_cm ?? "–"}</td>
                  <td className="text-right">{x.hip_cm ?? "–"}</td>
                  <td className="text-right">{x.chest_cm ?? "–"}</td>
                  <td className="text-right">{x.arm_cm ?? "–"}</td>
                  <td className="text-right">{x.thigh_cm ?? "–"}</td>
                  <td className="text-right">
                    {isOwner ? (
                      <form action={deleteBodyMetric.bind(null, x.id)}>
                        <button className="text-xs text-fg-muted hover:text-danger" aria-label="Delete entry">✕</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {metrics.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-fg-muted">All entries (tap ✎ to fix one)</summary>
          <ul className="mt-2 divide-y divide-border">
            {[...metrics].reverse().map((x) => {
              const parts = [
                x.weight_kg != null ? `${x.weight_kg} kg` : null,
                x.body_fat_pct != null ? `${x.body_fat_pct}% fat` : null,
                x.waist_cm != null ? `waist ${x.waist_cm}` : null,
                x.hip_cm != null ? `hip ${x.hip_cm}` : null,
                x.bp_systolic != null ? `BP ${x.bp_systolic}/${x.bp_diastolic}` : null,
                x.resting_hr != null ? `HR ${x.resting_hr}` : null,
                x.blood_glucose_mgdl != null ? `sugar ${x.blood_glucose_mgdl}${x.glucose_context ? ` (${x.glucose_context.replace("_", " ")})` : ""}` : null,
              ].filter(Boolean);
              return (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>{shortDate(localDate(x.measured_at, tz))} {localTime(x.measured_at, tz)} · {parts.join(" · ")}</span>
                  <span className="flex items-center gap-1">
                    {canWrite ? (
                      <EditRecord
                        fields={BODY_FIELDS}
                        values={{
                          when: `${localDate(x.measured_at, tz)}T${localTime(x.measured_at, tz)}`,
                          weight_kg: x.weight_kg, body_fat_pct: x.body_fat_pct, waist_cm: x.waist_cm, hip_cm: x.hip_cm, chest_cm: x.chest_cm, arm_cm: x.arm_cm, thigh_cm: x.thigh_cm,
                          resting_hr: x.resting_hr, bp_systolic: x.bp_systolic, bp_diastolic: x.bp_diastolic, blood_glucose_mgdl: x.blood_glucose_mgdl, glucose_context: x.glucose_context, notes: x.notes,
                        }}
                        onSave={updateBodyMetric.bind(null, x.id, ownerId)}
                      />
                    ) : null}
                    {isOwner ? (
                      <form action={deleteBodyMetric.bind(null, x.id)}>
                        <button className="text-xs text-fg-muted hover:text-danger" aria-label="Delete entry">✕</button>
                      </form>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
