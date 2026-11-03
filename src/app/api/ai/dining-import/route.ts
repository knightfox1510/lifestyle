import { z } from "zod";
import type { Part } from "@google/genai";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { diningImportSchema } from "@/lib/ai/phase2-schemas";
import { todayIn } from "@/lib/dates";

/** Long AI jobs (documents, photos, whole-week plans) can take a while: up to 5 minutes on Vercel. */
export const maxDuration = 300;

const MAX_IMAGES = 10;

/**
 * Many restaurants at once: screenshots of Swiggy/Zomato "Your orders" or
 * favourites, order confirmation emails, or a typed list of names. Returns
 * restaurants with any past orders found, for review before saving.
 */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("dining")) throw new AiError("Dining is turned off.", 403);
    const form = await request.formData();
    const text = z.string().trim().max(30000).parse(form.get("text") ?? "");
    const photos = form.getAll("photos").slice(0, MAX_IMAGES);
    const images = (await Promise.all(photos.map((p) => imagePart(p)))).filter(Boolean) as Part[];
    if (!images.length && !text) throw new AiError("Add screenshots or paste your orders or a list of restaurants.");
    const { data: saved } = await session.supabase.from("dining_places").select("name").eq("household_id", session.household.id).limit(300);
    const today = todayIn(session.profile.timezone);

    return runJson(session, {
      feature: "dining_import",
      maxDuration,
      quick: true,
      schema: diningImportSchema,
      temperature: 0.1,
      parts: [
        ...images,
        {
          text: `Today is ${today}. These are from an Indian household: screenshots of Swiggy/Zomato/EatSure/magicpin order history, order details or favourites, order confirmation emails, a bank/UPI statement, or just a list of restaurant names.
Extract every restaurant, grouped, with its past orders when they're shown:
- One entry per restaurant (merge the same restaurant across screenshots). Skip anything that isn't a restaurant or cloud kitchen (groceries from Instamart/Blinkit/Zepto, medicines, taxis).
- Orders: date, each item with quantity ("2 x Butter Naan" = Butter Naan, quantity 2) and total paid. Don't repeat an order that appears in two screenshots. If only the restaurant is shown with no items, leave orders empty.
- Estimate nutrition per ONE item for realistic Indian restaurant portions (richer than home food).
- platform: from the app's look or the text; "dine_in" for a list of places they eat at, "other" if unknown.
- Don't invent restaurants or dishes that aren't there.
Saved restaurants (use these names exactly when one matches): ${(saved ?? []).map((p) => p.name).join(", ") || "none yet"}.${text ? `\n\nText:\n${text}` : ""}`,
        },
      ],
    });
  });
}
