import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { foodEstimateSchema } from "@/lib/ai/phase2-schemas";

const SYSTEM = `You estimate nutrition for food a person describes or photographs. Indian home food is common: use typical home portions (1 phulka ≈ 70 kcal, 1 katori dal ≈ 150 kcal, 1 cup cooked rice ≈ 200 kcal) unless a size is given.
Split into separate items. Round calories to the nearest 5. Be realistic, not optimistic. If a photo is unclear, make a sensible guess and say so in note.`;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("food_diary")) throw new AiError("Food diary is turned off.", 403);
    const form = await request.formData();
    const text = z.string().trim().max(1000).parse(form.get("text") ?? "");
    const hint = z.string().max(40).parse(form.get("time") ?? "");
    const photo = await imagePart(form.get("photo"));
    if (!text && !photo) throw new AiError("Describe the food or add a photo.");
    const parts = [
      ...(photo ? [photo] : []),
      { text: `Local time: ${hint || "unknown"}.\n${text ? `What I ate: ${text}` : "Estimate the food in this photo."}` },
    ];
    return runJson(session, { feature: "food_estimate", schema: foodEstimateSchema, parts, system: SYSTEM, temperature: 0.2 });
  });
}
