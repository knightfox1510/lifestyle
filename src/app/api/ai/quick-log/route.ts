import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { quickLogSchema } from "@/lib/ai/phase2-schemas";

const body = z.object({ text: z.string().trim().min(1).max(1000), localTime: z.string().regex(/^\d{2}:\d{2}$/) });

const SYSTEM = `Turn a short spoken or typed note into structured log entries.
- food: things eaten, with realistic calorie/macro estimates (Indian home portions by default); meal from context or time.
- drinks: water, tea, coffee, etc. with ml (cup of tea/coffee ≈ 150 ml, glass ≈ 250 ml, bottle ≈ 500 ml unless stated). Tea, coffee and cola are caffeinated.
- bladder: leaks (with amount drops/small/medium/large), urges, bathroom visits (void); triggers like cough, sneeze, laugh, lifting, exercise, yoga, running, jumping, standing_up, bending, urgency, during_sleep.
- weight_kg if they mention weighing themselves.
Times as HH:MM 24h if mentioned ("at 7:40", "this morning" ≈ 08:00), else null. Don't invent entries.`;

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const input = body.safeParse(await request.json());
    if (!input.success) throw new AiError("Type or say what to log.");
    return runJson(session, {
      feature: "quick_log",
      schema: quickLogSchema,
      parts: [{ text: `Current local time: ${input.data.localTime}.\nNote: ${input.data.text}` }],
      system: SYSTEM,
      temperature: 0.1,
    });
  });
}
