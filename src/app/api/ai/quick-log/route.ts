import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { quickLogSchema } from "@/lib/ai/phase2-schemas";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

const body = z.object({ text: z.string().trim().min(1).max(1000), localTime: z.string().regex(/^\d{2}:\d{2}$/) });

const SYSTEM = `Turn a short spoken or typed note into structured log entries.
- food: things eaten, with realistic calorie/macro estimates (Indian home portions by default); meal from context or time ("other" = drinks or bites outside the usual meals).
- drinks: water, tea, coffee, etc. with ml (cup of tea/coffee ≈ 150 ml, glass ≈ 250 ml, bottle ≈ 500 ml unless stated). Tea, coffee and cola are caffeinated.
- bladder: leaks (with amount drops/small/medium/large), urges, bathroom visits (void); triggers like cough, sneeze, laugh, lifting, exercise, yoga, running, jumping, standing_up, bending, urgency, during_sleep.
- weight_kg if they mention weighing themselves.
Times as HH:MM 24h if mentioned ("at 7:40", "this morning" ≈ 08:00), else null. Don't invent entries.`;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const input = body.safeParse(await request.json());
    if (!input.success) throw new AiError("Type or say what to log.");

    // Saved restaurant dishes, so "had the smash burger from Good Flippin'" uses their numbers.
    let menu = "";
    if (session.isModuleEnabled("dining")) {
      const [{ data: places }, { data: dishes }] = await Promise.all([
        session.supabase.from("dining_places").select("id, name").eq("household_id", session.household.id),
        session.supabase.from("dining_dishes").select("name, place_id, calories, protein_g, carbs_g, fat_g").eq("household_id", session.household.id).not("calories", "is", null).limit(400),
      ]);
      const placeName = new Map((places ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
      const lines = ((dishes ?? []) as { name: string; place_id: string; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[]).map(
        (d) => `- ${d.name} (${placeName.get(d.place_id) ?? "?"}): ${d.calories} kcal, P ${d.protein_g ?? 0}, C ${d.carbs_g ?? 0}, F ${d.fat_g ?? 0}`,
      );
      if (lines.length) menu = `\n\nSaved restaurant dishes (per person). If the note mentions one, use its name with the restaurant in brackets and these exact numbers (scaled for half/shared portions):\n${lines.join("\n")}`;
    }

    return runJson(session, {
      feature: "quick_log",
      schema: quickLogSchema,
      parts: [{ text: `Current local time: ${input.data.localTime}.\nNote: ${input.data.text}${menu}` }],
      system: SYSTEM,
      temperature: 0.1,
    });
  });
}
