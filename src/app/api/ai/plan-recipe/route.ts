import { z } from "zod";
import { getSession } from "@/lib/session";
import { aiHandler, runJson } from "@/lib/ai/run";
import { mealIdeaSchema } from "@/lib/ai/phase2-schemas";
import { SAFETY_INSTRUCTIONS, buildAiContext } from "@/lib/ai/context";

/** Writing a full recipe can take a little while. */
export const maxDuration = 300;

const body = z.object({ title: z.string().trim().min(1).max(150), servings: z.number().int().min(1).max(12) });

/** A full recipe (ingredients, steps, macros) for a dish on the week plan, ready to save. */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const input = body.parse(await request.json());
    const ctx = await buildAiContext(session, { subjectId: session.userId, useMedicalHistory: false });
    const prompt = `Write a practical home recipe for "${input.title}" for ${input.servings} serving(s), the way it's usually made in an Indian (often Maharashtrian) home.
Give ingredients with quantities for all servings (grocery categories), short numbered steps, prep and cook minutes, calories and macros PER SERVING, and 2–4 tags (e.g. "high protein", "quick", "vegetarian"). "why" is one sentence on what makes it a good choice for them.`;
    return runJson(session, {
      feature: "plan_recipe",
      maxDuration,
      schema: mealIdeaSchema,
      parts: [{ text: prompt }],
      system: `${SAFETY_INSTRUCTIONS}\nYou are also a practical home cook.\n\n${ctx.text}`,
      usedHealth: ctx.usedMedical,
      temperature: 0.4,
    });
  });
}
