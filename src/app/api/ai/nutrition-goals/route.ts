import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { nutritionGoalSchema } from "@/lib/ai/phase2-schemas";
import { SAFETY_INSTRUCTIONS, buildAiContext } from "@/lib/ai/context";
import { personFacts } from "@/lib/ai/person-facts";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

const body = z.object({
  subjectId: z.uuid(),
  goal: z.enum(["lose", "maintain", "gain", "recomp"]),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  diet_type: z.string().max(30),
  useMedicalHistory: z.boolean().optional(),
});

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const input = body.parse(await request.json());
    if (session.accessTo("food_diary", input.subjectId) !== "write") throw new AiError("You can't set goals for this person.", 403);
    const [ctx, facts] = await Promise.all([
      buildAiContext(session, { subjectId: input.subjectId, useMedicalHistory: input.useMedicalHistory, brief: true }),
      personFacts(session, input.subjectId),
    ]);
    const prompt = `Suggest daily nutrition targets.
Goal: ${input.goal}. Activity: ${input.activity_level}. Diet: ${input.diet_type}.
${facts.text || "No body measurements recorded; assume an average adult and say so in the rationale."}
Rules: fat loss deficit 300–500 kcal (never below 1200 kcal for women / 1500 for men without medical supervision); protein 1.6–2.2 g/kg for recomp or muscle gain, 1.2–1.6 otherwise; fibre 25–35 g; water about 30–35 ml/kg unless their health data says otherwise. Adjust for medical conditions, lab results and medicines in the context.`;
    return runJson(session, {
      feature: "nutrition_goals",
      schema: nutritionGoalSchema,
      parts: [{ text: prompt }],
      system: `${SAFETY_INSTRUCTIONS}\n\n${ctx.text}`,
      usedHealth: ctx.usedMedical,
      temperature: 0.2,
    });
  });
}
