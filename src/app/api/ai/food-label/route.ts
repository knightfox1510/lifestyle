import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { labelSchema } from "@/lib/ai/phase2-schemas";

const PROMPT = `Read this packaged-food nutrition label (Indian labels usually show "per 100 g" and sometimes "per serve"). Return the product name and brand from the pack, serving size, and nutrients per 100 g/ml exactly as printed (convert from per-serve only if per 100 g is missing). Units: kcal, g, mg, µg. If sodium isn't printed but salt is, sodium mg = salt g ÷ 2.5 × 1000. Read the ingredient list for bladder irritants (caffeine, artificial sweeteners like sucralose/aspartame, chocolate/cocoa, chilli, carbonated). Use null for anything not on the label; never guess.`;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const form = await request.formData();
    const photo = await imagePart(form.get("photo"));
    if (!photo) throw new AiError("Take a photo of the nutrition label.");
    return runJson(session, { feature: "food_label", schema: labelSchema, parts: [photo, { text: PROMPT }], temperature: 0 });
  });
}
