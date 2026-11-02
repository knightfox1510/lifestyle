import "server-only";

import type { AppSession } from "@/lib/session";
import type { BodyGoals, BodyMetric, MedicalProfile, NutritionGoals } from "@/lib/types";
import { maintenanceCalories } from "@/modules/food/meta";
import { bmi } from "@/modules/body/stats";

/** Body + nutrition facts used by food AI features (respecting sharing). */
export async function personFacts(session: AppSession, subjectId: string) {
  const can = (k: string) => session.isModuleEnabled(k) && session.accessTo(k, subjectId) !== "none";
  const db = session.supabase;
  const [mp, bm, bg, ng] = await Promise.all([
    can("medical_records") ? db.from("medical_profiles").select("*").eq("owner_id", subjectId).maybeSingle() : null,
    can("body_recomp") ? db.from("body_metrics").select("*").eq("owner_id", subjectId).not("weight_kg", "is", null).order("measured_at", { ascending: false }).limit(1) : null,
    can("body_recomp") ? db.from("body_goals").select("*").eq("owner_id", subjectId).maybeSingle() : null,
    can("food_diary") ? db.from("nutrition_goals").select("*").eq("owner_id", subjectId).maybeSingle() : null,
  ]);
  const profile = (mp?.data ?? null) as MedicalProfile | null;
  const weight = ((bm?.data ?? []) as BodyMetric[])[0]?.weight_kg ?? null;
  const goals = (bg?.data ?? null) as BodyGoals | null;
  const nutrition = (ng?.data ?? null) as NutritionGoals | null;
  const age = profile?.date_of_birth ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 86400_000)) : null;

  const maintenance =
    weight && profile?.height_cm && age
      ? maintenanceCalories({ weightKg: Number(weight), heightCm: Number(profile.height_cm), age, sex: profile.sex, activity: nutrition?.activity_level ?? "moderate" })
      : null;

  const lines = [
    weight ? `Current weight: ${weight} kg.` : null,
    profile?.height_cm ? `Height: ${profile.height_cm} cm.` : null,
    weight && profile?.height_cm ? `BMI: ${bmi(Number(weight), Number(profile.height_cm))} (Indian adult cut-offs: 23 overweight, 25 obese).` : null,
    age ? `Age: ${age}.` : null,
    profile?.sex ? `Sex: ${profile.sex}.` : null,
    goals?.target_weight_kg ? `Target weight: ${goals.target_weight_kg} kg${goals.target_date ? ` by ${goals.target_date}` : ""}.` : null,
    nutrition ? `Nutrition goal: ${nutrition.goal}; diet: ${nutrition.diet_type}; activity: ${nutrition.activity_level}; cooking style: ${nutrition.cooking_style}${nutrition.cuisines.length ? `; likes ${nutrition.cuisines.join(", ")} food` : ""}${nutrition.dislikes ? `; dislikes/avoid: ${nutrition.dislikes}` : ""}.` : null,
    nutrition?.calories ? `Daily targets: ${nutrition.calories} kcal, ${nutrition.protein_g ?? "?"} g protein, ${nutrition.carbs_g ?? "?"} g carbs, ${nutrition.fat_g ?? "?"} g fat.` : null,
    maintenance ? `Estimated maintenance (Mifflin–St Jeor): ~${maintenance} kcal/day.` : null,
  ].filter(Boolean);

  return { text: lines.join("\n"), weight: weight ? Number(weight) : null, maintenance, nutrition, goals };
}
