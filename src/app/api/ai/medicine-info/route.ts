import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { medicineInfoSchema } from "@/lib/ai/health-schemas";

/** A photo of a strip or box can take a while to read. */
export const maxDuration = 300;

const PROMPT = `Identify this medicine as sold in India and give its composition per ONE unit (one tablet, capsule, ml, sachet…).
Indian brand names are common (e.g. "Shelcal 500", "Mirago 25" = mirabegron 25 mg, "Pan 40" = pantoprazole 40 mg). If a photo of the strip or box is given, read the composition printed on it and prefer that over memory.
Only fill per_unit for vitamins and minerals the product actually contains (calcium, vitamin D, iron, folic acid, B12, zinc, magnesium, vitamin C, vitamin A); use null for everything else. Use ELEMENTAL amounts for minerals (calcium carbonate is 40% calcium, ferrous fumarate 33% iron, ferrous ascorbate ~12% iron, zinc sulphate monohydrate 36% zinc). Vitamin D IU ÷ 40 = µg.
If you are not confident which product this is, set recognised=false and leave ingredients null. Never invent a composition.`;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("medicines")) throw new AiError("Medicines are turned off.", 403);
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim().slice(0, 120);
    const strength = String(form.get("strength") ?? "").trim().slice(0, 60);
    const photo = await imagePart(form.get("photo"));
    if (!name && !photo) throw new AiError("Type the medicine name or add a photo of the strip.");
    const text = `${PROMPT}\n\nMedicine: ${name || "(see photo)"}${strength ? ` ${strength}` : ""}`;
    return runJson(session, {
      feature: "medicine_info",
      maxDuration,
      quick: true,
      schema: medicineInfoSchema,
      parts: photo ? [photo, { text }] : [{ text }],
      temperature: 0,
      system: "You are a careful pharmacist's assistant. You give factual composition data only and never advise on dosing changes.",
      // A brand's composition doesn't change: the same name looked up again reuses the answer.
      cache: photo ? undefined : { key: `${name.toLowerCase()}\n${strength.toLowerCase()}`, days: 180 },
    });
  });
}
