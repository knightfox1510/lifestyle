/**
 * Coach check-in (pure; unit-tested): once a plan's review date arrives,
 * how the days since compare with what it set out.
 */
export type CheckinPlan = { calories_kcal: number | null; protein_g: number | null; steps_per_day: number | null; expected_kg_per_week: number | null; review_in_days: number };
export type CheckinFacts = {
  daysSince: number;
  due: boolean;
  kcal: { planned: number; actual: number } | null;
  protein: { planned: number; actual: number } | null;
  steps: { planned: number; actual: number } | null;
  weight: { change: number; expected: number | null } | null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function coachCheckin(
  plan: CheckinPlan,
  since: string,
  today: string,
  data: { foodByDay: { kcal: number; protein: number }[]; steps: number[]; weights: { day: string; kg: number }[] },
): CheckinFacts {
  const daysSince = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`)) / 864e5);
  const full = data.foodByDay.filter((d) => d.kcal >= 800);
  const kcal = mean(full.map((d) => d.kcal));
  const protein = mean(full.map((d) => d.protein));
  const steps = mean(data.steps.filter((s) => s > 0));
  const w = [...data.weights].sort((a, b) => a.day.localeCompare(b.day));
  return {
    daysSince,
    due: daysSince >= plan.review_in_days,
    kcal: plan.calories_kcal && kcal != null && full.length >= 3 ? { planned: plan.calories_kcal, actual: Math.round(kcal) } : null,
    protein: plan.protein_g && protein != null && full.length >= 3 ? { planned: plan.protein_g, actual: Math.round(protein) } : null,
    steps: plan.steps_per_day && steps != null ? { planned: plan.steps_per_day, actual: Math.round(steps) } : null,
    weight: w.length >= 2 ? { change: Math.round((w.at(-1)!.kg - w[0].kg) * 10) / 10, expected: plan.expected_kg_per_week != null ? Math.round(plan.expected_kg_per_week * (daysSince / 7) * 10) / 10 : null } : null,
  };
}
