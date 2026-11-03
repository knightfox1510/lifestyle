import { z } from "zod";
import type { Part } from "@google/genai";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { menuExtractSchema } from "@/lib/ai/phase2-schemas";

/** Long AI jobs (documents, photos, whole-week plans) can take a while: up to 5 minutes on Vercel. */
export const maxDuration = 300;

const MAX_IMAGES = 6;

const PROMPT = `Extract the restaurant menu from these screenshots/photos and/or text (often Zomato or Swiggy screenshots, or a paper menu from an Indian restaurant).
- One entry per dish. Use the printed name and price (one portion; if there are size options, use the regular/standard size and mention others in description).
- veg: green square/dot mark = true, red/brown triangle/dot = false, otherwise null.
- section = the menu heading the dish sits under.
- Skip offers, coupons, ratings, delivery info, "customisable" labels, add-ons/extras, and app UI text. Don't repeat dishes that appear in several screenshots.
- Estimate nutrition per ONE person's share: realistic Indian restaurant portions, which are richer than home cooking (more oil, butter, cream, sugar). If a dish says "serves 2", set serves=2 and give per-person numbers.
- Pasted text may be a whole restaurant web page (or one part of it) copied with the "Copy menu to Hearth" button: labels in [brackets] such as [Veg Item] or [Non-veg item] belong to the dish right after them. Ignore ratings, reviews, "Bestseller", "ADD", "Customisable", offers and page navigation. The part may start or end mid-dish: skip a dish if its name is cut off.
- Don't invent dishes that aren't visible.`;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("dining")) throw new AiError("Dining is turned off.", 403);
    const form = await request.formData();
    const placeId = z.uuid().parse(form.get("placeId"));
    const { data: place } = await session.supabase.from("dining_places").select("name, cuisine").eq("id", placeId).eq("household_id", session.household.id).maybeSingle();
    if (!place) throw new AiError("Restaurant not found.", 404);

    const text = z.string().trim().max(20000).parse(form.get("text") ?? "");
    const photos = form.getAll("photos").slice(0, MAX_IMAGES);
    const images = (await Promise.all(photos.map((p) => imagePart(p)))).filter(Boolean) as Part[];
    if (!images.length && !text) throw new AiError("Add menu screenshots or paste the menu text.");

    return runJson(session, {
      feature: "menu_import", maxDuration, quick: true,
      schema: menuExtractSchema,
      parts: [
        ...images,
        { text: `Restaurant: ${place.name}${place.cuisine ? ` (${place.cuisine})` : ""}.\n${PROMPT}${text ? `\n\nMenu text:\n${text}` : ""}` },
      ],
      temperature: 0.1,
    });
  });
}
