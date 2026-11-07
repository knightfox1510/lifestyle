import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError, assertQuota, generate, recordUsage } from "@/lib/ai/gemini";
import { SAFETY_INSTRUCTIONS, buildAiContext } from "@/lib/ai/context";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  subjectId: z.uuid().optional(),
  /** Per-request override of the person's default. Omit to use the default. */
  useMedicalHistory: z.boolean().optional(),
  /** Return the context that would be sent, without calling the model. */
  previewOnly: z.boolean().optional(),
  /** Full thinking (and Pro, if the household chose "Best"); otherwise light thinking on Flash. */
  thinkHarder: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { prompt, useMedicalHistory, previewOnly, thinkHarder } = parsed.data;
  const feature = thinkHarder ? "assistant_deep" : "assistant";
  const subjectId = parsed.data.subjectId ?? session.userId;

  if (!session.members.some((m) => m.user_id === subjectId)) {
    return NextResponse.json({ error: "Unknown person" }, { status: 403 });
  }

  const context = await buildAiContext(session, { subjectId, useMedicalHistory });
  if (previewOnly) return NextResponse.json({ context: context.text, stats: context.stats, usedMedical: context.usedMedical });

  try {
    await assertQuota(session, feature);
    const res = await generate(session, {
      contents: prompt,
      config: {
        systemInstruction: `${SAFETY_INSTRUCTIONS}\n\n${context.text}`,
        temperature: 0.6,
      },
    }, { feature });
    await recordUsage(session, feature, context.usedMedical, res);
    return NextResponse.json({ answer: res.text ?? "", usedMedical: context.usedMedical, stats: context.stats });
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("assistant failed", err);
    return NextResponse.json({ error: "The AI request failed. Try again in a moment." }, { status: 502 });
  }
}
