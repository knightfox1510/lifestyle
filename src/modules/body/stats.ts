/**
 * Body numbers from height, weight, waist, age and sex (pure; unit-tested).
 * BMI uses the cut-offs recommended for Indian adults (Misra et al., 2009;
 * ICMR/WHO Asia-Pacific): overweight from 23, obesity from 25.
 */

export type BmiBand = "under" | "healthy" | "over" | "obese";

const r1 = (n: number) => Math.round(n * 10) / 10;

export function bmi(weightKg: number, heightCm: number) {
  return r1(weightKg / (heightCm / 100) ** 2);
}

export function bmiBand(value: number): BmiBand {
  return value < 18.5 ? "under" : value < 23 ? "healthy" : value < 25 ? "over" : "obese";
}

export const BMI_LABEL: Record<BmiBand, string> = { under: "Underweight", healthy: "Healthy range", over: "Overweight", obese: "Obese range" };

/** Weight range that gives a BMI of 18.5–22.9 at this height. */
export function healthyWeightRange(heightCm: number) {
  const m2 = (heightCm / 100) ** 2;
  return { low: r1(18.5 * m2), high: r1(22.9 * m2) };
}

/** Waist ÷ height: under 0.5 is the usual goal; 0.6+ is high cardio-metabolic risk. */
export function waistToHeight(waistCm: number, heightCm: number) {
  const v = Math.round((waistCm / heightCm) * 100) / 100;
  return { value: v, band: v < 0.5 ? ("ok" as const) : v < 0.6 ? ("raised" as const) : ("high" as const) };
}

/** Waist above 90 cm (men) / 80 cm (women) raises risk for Indian adults. */
export function waistRisk(waistCm: number, sex: "female" | "male" | "other" | null) {
  if (sex !== "male" && sex !== "female") return null;
  return waistCm > (sex === "male" ? 90 : 80);
}

/** Basal metabolic rate (Mifflin–St Jeor), kcal/day. */
export function bmr(weightKg: number, heightCm: number, age: number, sex: "female" | "male" | "other" | null) {
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : sex === "female" ? -161 : -78));
}

export function ageOn(dateOfBirth: string, today: string) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Protein suggestion: 0.8 g/kg (ICMR RDA) up to 1.2–1.6 g/kg when losing fat or training. */
export function proteinRange(weightKg: number) {
  return { rda: Math.round(weightKg * 0.8), active: [Math.round(weightKg * 1.2), Math.round(weightKg * 1.6)] as const };
}
