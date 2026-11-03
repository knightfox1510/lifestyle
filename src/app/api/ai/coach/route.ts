import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { SAFETY_INSTRUCTIONS } from "@/lib/ai/context";
import { coachSchema } from "@/lib/ai/coach-schema";
import { loadCoachData } from "@/lib/coach";
import { COACH_GOALS, COACH_GOAL_LABEL, COACH_SOURCES } from "@/modules/coach/facts";

/** A full review with everything included can take a while: up to 5 minutes on Vercel. */
export const maxDuration = 300;

const body = z.object({
  goal: z.enum(COACH_GOALS),
  days: z.union([z.literal(14), z.literal(30), z.literal(60), z.literal(90)]),
  include: z.array(z.enum(COACH_SOURCES.map((s) => s.key) as [string, ...string[]])).max(COACH_SOURCES.length),
  question: z.string().trim().max(600).optional(),
});

const COACH_RULES = `You are an evidence-based body-composition and lifestyle coach for an Indian household. You get facts we computed from their own logs, plus optional medical notes.
How to coach:
- Work from the numbers given; quote them in "evidence". Never invent data. If something wasn't included or is thin, say so in data_gaps instead of guessing.
- Fat loss: aim for about 0.5–1% of body weight per week (slower if lean, older, or with medical conditions). Keep protein high (about 1.6–2.2 g per kg of target body weight; at least 1.2 g/kg), strength training 2–4×/week to keep muscle, steps as the easiest extra burn, 7–9 h sleep. Never set calories below roughly BMR, 1,200 kcal (women) or 1,500 kcal (men) without a doctor.
- Use the energy-balance facts: if the scale trend implies a much higher burn than estimated maintenance, the food log is probably missing things (oil, ghee, tea sugar, snacks, drinks); say so kindly and suggest how to log better before cutting calories further. If weight is falling faster than ~1%/week, suggest eating a bit more.
- Read recovery: short sleep, rising resting heart rate or falling HRV mean ease off the deficit or training intensity. Link sleep and next-day eating if the data shows it.
- Respect diet type (vegetarian/Jain/eggetarian…), allergies, dislikes and conditions. Food ideas should be ordinary Indian home food with katori/roti/piece portions, and high-protein vegetarian options (dal, chana, rajma, paneer, curd, soy, sprouts, eggs if allowed).
- Medicines and labs: mention when one may affect weight, appetite, blood sugar or heart rate (e.g. thyroid, diabetes, steroids, beta-blockers, antidepressants) and that changes need their doctor. Flag abnormal labs relevant to the goal (HbA1c, lipids, thyroid, vitamin D, B12, iron).
- Keep it encouraging, specific and doable this week. Plan numbers should be round (calories to the nearest 50).`;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const input = body.parse(await request.json());
    const ownerId = session.subject.user_id;
    if (session.accessTo("body_recomp", ownerId) === "none") throw new AiError("Not shared with you.", 403);
    if (!input.include.length) throw new AiError("Choose at least one kind of data to include.");

    const data = await loadCoachData(session, ownerId, input.include as never, input.days);
    if (!data.included.length) throw new AiError("None of the chosen data is available.");
    const subject = session.members.find((m) => m.user_id === ownerId);
    const prompt = `Goal: ${COACH_GOAL_LABEL[input.goal]}.
${input.question ? `Their question: ${input.question}\n` : ""}Included data: ${data.included.map((k) => COACH_SOURCES.find((s) => s.key === k)?.label).join(", ")}. Not included (don't assume anything about these): ${COACH_SOURCES.filter((s) => !data.included.includes(s.key)).map((s) => s.label).join(", ") || "nothing"}.

=== COMPUTED FACTS ===
${data.lines.join("\n")}
${data.sections.length ? `\n=== OTHER DETAILS ===\n${data.sections.join("\n\n")}` : ""}

Give insights and a plan for this goal. Answer the question directly in the summary if they asked one.`;

    const result = await runJson(session, {
      feature: "coach",
      schema: coachSchema,
      parts: [{ text: prompt }],
      system: `${SAFETY_INSTRUCTIONS}\n\n${COACH_RULES}\n\nPerson: ${subject?.display_name ?? "household member"}. Today: ${data.today}.`,
      usedHealth: data.usedHealth,
      temperature: 0.4,
      maxDuration,
    });

    const { data: saved, error } = await session.supabase
      .from("coach_reports")
      .insert({ household_id: session.household.id, owner_id: ownerId, created_by: session.userId, goal: input.goal, question: input.question || null, period_days: input.days, included: data.included, facts: data.facts, result })
      .select("id, created_at")
      .single();
    if (error) console.error("coach report not saved", error.message);
    return { id: saved?.id ?? null, created_at: saved?.created_at ?? new Date().toISOString(), goal: input.goal, question: input.question ?? null, period_days: input.days, included: data.included, facts: data.facts, result, applied_at: null, saveError: error ? "The report couldn't be saved (run the latest database update in Supabase)." : null };
  });
}
