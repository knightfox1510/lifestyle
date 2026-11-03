import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { menuExtractSchema } from "@/lib/ai/phase2-schemas";

/** Searching the web and writing out a whole menu takes 30-60 s. */
export const maxDuration = 300;

const body = z.object({ placeId: z.uuid(), city: z.string().trim().max(80).optional() });

/**
 * Finds a restaurant's current menu online (Swiggy, Zomato, the restaurant's
 * own site) with Google Search, so it doesn't have to be screenshotted.
 * Returns the same shape as a screenshot import, for the same review step.
 */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("dining")) throw new AiError("Dining is turned off.", 403);
    const { placeId, city } = body.parse(await request.json());
    const { data: place } = await session.supabase.from("dining_places").select("name, cuisine, area").eq("id", placeId).eq("household_id", session.household.id).maybeSingle();
    if (!place) throw new AiError("Restaurant not found.", 404);
    const where = [place.area, city].filter(Boolean).join(", ");

    const res = await runJson(session, {
      feature: "menu_online",
      maxDuration,
      search: true,
      quick: true,
      schema: menuExtractSchema,
      temperature: 0.1,
      parts: [
        {
          text: `Find the current menu of the restaurant "${place.name}"${place.cuisine ? ` (${place.cuisine})` : ""}${where ? ` in ${where}` : ""}, India. Search Swiggy, Zomato, EatSure, magicpin and the restaurant's own website.
- List the dishes actually on its menu, with section and price in ₹ (regular size; other sizes in description). Up to 80 dishes: for a big menu, the most popular and main dishes first.
- veg: true/false from the listing, null if unknown.
- Estimate nutrition per ONE person's share for realistic Indian restaurant portions (richer than home food). If a dish serves 2, set serves=2 and give per-person numbers.
- Only dishes you found for this restaurant (or this chain): don't make up a menu. If you can't find it, return no items and say so in note.
- In note, say where the menu came from (e.g. "Swiggy listing, Baner") and that prices can differ by outlet.`,
        },
      ],
    });
    return res;
  });
}
