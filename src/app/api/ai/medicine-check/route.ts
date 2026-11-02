import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { buildAiContext } from "@/lib/ai/context";
import { medicineCheckSchema } from "@/lib/ai/health-schemas";
import { medicineChecksFor } from "@/lib/medicine-checks";
import { aiLanguageLine } from "@/lib/i18n/server";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

/**
 * AI second look at a medicine list, with the person's conditions, allergies
 * and lab results. Complements the rule-based checks; never a prescription.
 */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const { subjectId } = z.object({ subjectId: z.uuid() }).parse(await request.json());
    if (!session.members.some((m) => m.user_id === subjectId)) throw new AiError("Unknown person", 403);
    if (session.accessTo("medicines", subjectId) === "none") throw new AiError("You can't see this person's medicines.", 403);
    const [checks, ctx] = await Promise.all([medicineChecksFor(session, subjectId), buildAiContext(session, { subjectId, useMedicalHistory: true })]);
    if (!checks.list.length) throw new AiError("No active medicines or supplements to check.");

    const listText = checks.list
      .map((m) => `- ${m.name}${m.strength ? ` ${m.strength}` : ""}${m.ingredients ? ` [contains: ${m.ingredients}]` : ""}${m.kind === "supplement" ? " (supplement)" : ""}${m.times?.length ? ` at ${m.times.join(", ")}` : m.kind === "medicine" ? " (as needed)" : ""}`)
      .join("\n");
    const already = checks.findings.map((f) => `- ${f.title}`).join("\n") || "(none)";

    const result = await runJson(session, {
      feature: "medicine_check",
      schema: medicineCheckSchema,
      usedHealth: true,
      temperature: 0.2,
      system: `You are a careful clinical pharmacist reviewing a home medicine list for an Indian household. Identify ingredients from Indian brand names.
Look for: duplicate ingredients, interactions, clashes with the person's conditions, allergies, kidney/liver or other lab results, pregnancy if recorded, dose timing problems (food, other medicines), and anything that may worsen bladder control or night-time urination.
Only report real, well-established issues; don't pad the list. Never tell them to stop or change a prescribed medicine — say what to ask the doctor/pharmacist. Severity: high = could cause serious harm, medium = worth raising soon, info = practical tip.
${aiLanguageLine(session)}

${ctx.text}`,
      parts: [{ text: `Medicines and supplements:\n${listText}\n\nAlready flagged by the app's rule checks (don't repeat these):\n${already}` }],
    });
    return result;
  });
}
