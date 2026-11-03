import { z } from "zod";

export const COACH_AREAS = ["food", "body", "sleep", "activity", "training", "heart", "supplements", "medicines", "labs", "stress", "other"] as const;

/** What the AI coach answers with. Lists are capped; long ones are trimmed before validation. */
export const coachSchema = z.object({
  headline: z.string().max(160).describe("One sentence: where they stand against the goal right now, with the key number"),
  summary: z.string().max(900).describe("3-5 sentences tying the data together: what's working, what's holding them back"),
  insights: z
    .array(
      z.object({
        area: z.enum(COACH_AREAS),
        impact: z.enum(["positive", "watch", "concern"]),
        finding: z.string().max(220).describe("What the data shows, in plain words"),
        evidence: z.string().max(260).describe("The numbers behind it, from the data given (never invented)"),
      }),
    )
    .max(8)
    .describe("4-8 findings, most important first; include at least one thing that's going well"),
  plan: z.object({
    calories_kcal: z.number().int().min(1000).max(5000).nullable().describe("Daily calorie target, or null if not enough data"),
    protein_g: z.number().int().min(30).max(350).nullable(),
    carbs_g: z.number().int().min(20).max(700).nullable(),
    fat_g: z.number().int().min(20).max(250).nullable(),
    fiber_g: z.number().int().min(10).max(80).nullable(),
    steps_per_day: z.number().int().min(2000).max(30000).nullable(),
    sleep_hours: z.number().min(5).max(10).nullable(),
    workouts_per_week: z.number().int().min(0).max(14).nullable(),
    expected_kg_per_week: z.number().min(-1.5).max(1).nullable().describe("Expected weight change per week on this plan (negative = loss)"),
    review_in_days: z.number().int().min(7).max(60).describe("When to run the coach again to adjust"),
    rationale: z.string().max(900).describe("Why these numbers: maintenance, deficit/surplus, protein per kg, any medical adjustment"),
  }),
  this_week: z
    .array(
      z.object({
        area: z.enum(COACH_AREAS),
        action: z.string().max(140).describe("A specific, small action, e.g. 'Add 1 katori dal or 100 g paneer at lunch'"),
        why: z.string().max(220),
      }),
    )
    .max(6)
    .describe("3-6 most impactful changes for the next 7 days, easiest high-impact first"),
  sample_day: z
    .array(z.object({ meal: z.enum(["breakfast", "lunch", "snack", "dinner"]), idea: z.string().max(200), kcal: z.number().int().min(0).max(2500).nullable(), protein_g: z.number().int().min(0).max(200).nullable() }))
    .max(5)
    .describe("One example day of Indian home food that fits the targets, diet type and allergies"),
  training: z.array(z.string().max(220)).max(5).describe("Weekly training plan lines (strength, cardio, steps), adjusted for conditions"),
  recovery: z.array(z.string().max(220)).max(4).describe("Sleep, stress and recovery advice from their sleep, HRV and resting heart rate"),
  cautions: z.array(z.string().max(260)).max(4).describe("Medical points: medicines, labs, conditions to check with a doctor; empty if none"),
  data_gaps: z.array(z.string().max(200)).max(4).describe("What to log or measure to make the next review better"),
});
export type CoachResult = z.infer<typeof coachSchema>;
