import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { visitSummarySchema } from "@/lib/ai/health-schemas";
import { loadVisitData, visitDataText, VISIT_PERIODS } from "@/lib/visit-summary";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

/** Short doctor-facing overview of the visit summary data. */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const input = z
      .object({ subjectId: z.uuid(), days: z.number().int().refine((d) => (VISIT_PERIODS as readonly number[]).includes(d)), reason: z.string().max(200) })
      .parse(await request.json());
    if (!session.members.some((m) => m.user_id === input.subjectId)) throw new AiError("Unknown person", 403);
    if (session.accessTo("medical_records", input.subjectId) === "none") throw new AiError("You can't see this person's medical records.", 403);
    const v = await loadVisitData(session, input.subjectId, input.days);
    return runJson(session, {
      feature: "visit_summary",
      schema: visitSummarySchema,
      usedHealth: true,
      temperature: 0.2,
      system: `You prepare a brief, factual pre-visit summary that a patient hands to their doctor in India.
Use only the data given; never invent values or diagnoses. Lead with what matters for the stated visit reason.
'summary': 3–5 sentences. 'changes': notable changes or trends in the period (new symptoms, abnormal results, missed doses under 80%, weight/BP changes, bladder patterns). 'questions': practical questions the patient could ask.`,
      parts: [{ text: visitDataText(v, input.reason) }],
    });
  });
}
