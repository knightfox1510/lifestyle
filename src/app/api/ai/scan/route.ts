import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, imagePart, runJson } from "@/lib/ai/run";
import { scanSchema } from "@/lib/ai/phase2-schemas";

const PROMPTS = {
  receipt: `This is a grocery/shopping receipt (Indian stores and quick-commerce apps like Blinkit, Zepto, BigBasket, Swiggy Instamart are common). List each food or household product bought, with a clean generic name (expand abbreviations), quantity, category and where it would be stored. Skip totals, taxes, discounts, delivery fees and bags. expires_in_days = typical shelf life from purchase (e.g. milk 2, curd 4, bread 4, leafy greens 3, tomatoes 7, onions 30, rice 365), expiry_printed=false.`,
  shelf: `This is a photo of a fridge, freezer or kitchen shelf. List every distinct food item you can identify with a sensible quantity estimate. If an expiry date is printed and legible, use it (expiry_printed=true); otherwise estimate typical remaining shelf life for an item that looks like this. Don't invent items you can't see.`,
  list: `This is a shopping list (handwritten or typed) or a photo of empty packaging. List each item to buy with a clean name and quantity if written. location/expiry are not important here: use location 'pantry' and expires_in_days null.`,
} as const;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("pantry") && !session.isModuleEnabled("groceries")) throw new AiError("Pantry and groceries are turned off.", 403);
    const form = await request.formData();
    const mode = z.enum(["receipt", "shelf", "list"]).parse(form.get("mode"));
    const photo = await imagePart(form.get("photo"));
    if (!photo) throw new AiError("Take or choose a photo first.");
    return runJson(session, {
      feature: `scan_${mode}`,
      schema: scanSchema,
      parts: [photo, { text: PROMPTS[mode] }],
      temperature: 0.1,
    });
  });
}
