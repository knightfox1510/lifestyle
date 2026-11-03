"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import type { CoachResult } from "@/lib/ai/coach-schema";

const id = z.uuid();
const GOAL_MAP: Record<string, "lose" | "maintain" | "gain" | "recomp"> = { fat_loss: "lose", weight_loss: "lose", recomp: "recomp", muscle_gain: "gain", maintain: "maintain" };

/** Copies a coach plan's calories and macros into the person's nutrition goals (Food → Goals). */
export async function applyCoachPlan(reportId: string): Promise<ActionResult> {
  if (!id.safeParse(reportId).success) return { error: "Invalid report." };
  try {
    const session = await getSession();
    const { data } = await session.supabase.from("coach_reports").select("owner_id, goal, result, created_at").eq("id", reportId).maybeSingle();
    if (!data) return { error: "Report not found." };
    const plan = (data.result as CoachResult).plan;
    if (!plan?.calories_kcal) return { error: "This plan has no calorie target to use." };
    const s = await requireWrite("food_diary", data.owner_id);
    const values = {
      calories: plan.calories_kcal,
      ...(plan.protein_g ? { protein_g: plan.protein_g } : {}),
      ...(plan.carbs_g ? { carbs_g: plan.carbs_g } : {}),
      ...(plan.fat_g ? { fat_g: plan.fat_g } : {}),
      ...(plan.fiber_g ? { fiber_g: plan.fiber_g } : {}),
      ...(GOAL_MAP[data.goal] ? { goal: GOAL_MAP[data.goal] } : {}),
      rationale: `From the AI coach (${String(data.created_at).slice(0, 10)}): ${plan.rationale}`.slice(0, 1500),
    };
    const { error } = await s.supabase.from("nutrition_goals").upsert({ ...values, owner_id: data.owner_id, household_id: s.household.id }, { onConflict: "owner_id" });
    if (error) return { error: "Couldn't save the targets." };
    await s.supabase.from("coach_reports").update({ applied_at: new Date().toISOString() }).eq("id", reportId);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/food");
  refreshModule("/body");
  return { ok: true, message: "Targets saved to your nutrition goals." };
}

export async function deleteCoachReport(reportId: string): Promise<ActionResult> {
  if (!id.safeParse(reportId).success) return { error: "Invalid report." };
  const session = await getSession();
  const { error } = await session.supabase.from("coach_reports").delete().eq("id", reportId);
  if (error) return { error: "Couldn't delete the report." };
  refreshModule("/body");
  return { ok: true, message: "Report deleted." };
}
