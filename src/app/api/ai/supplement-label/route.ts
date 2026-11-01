import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { supplementLabelSchema } from "@/lib/ai/health-schemas";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

const PROMPT = `Read this supplement label (Indian brands are common). Return the product name and, for ONE dose (one tablet/capsule/sachet/scoop as printed), the amounts below.
Convert units: vitamin D IU ÷ 40 = µg; vitamin A IU × 0.3 = µg RAE; folic acid mg × 1000 = µg. For minerals, use the ELEMENTAL amount if printed (e.g. "ferrous fumarate 152 mg eq. to elemental iron 50 mg" → 50); if only the salt is printed, convert using standard percentages (ferrous fumarate 33% iron, ferrous sulphate 20%, calcium carbonate 40% calcium, zinc sulphate monohydrate 36% zinc).
Use null for anything not on the label. Never guess.`;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("supplements")) throw new AiError("Supplements are turned off.", 403);
    const form = await request.formData();
    const photo = await imagePart(form.get("photo"));
    if (!photo) throw new AiError("Take a photo of the supplement label.");
    return runJson(session, { feature: "supplement_label", schema: supplementLabelSchema, parts: [photo, { text: PROMPT }], temperature: 0 });
  });
}
