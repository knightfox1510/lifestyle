import "server-only";

import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import type { AppSession } from "@/lib/session";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { aiLanguageLine } from "@/lib/i18n/server";
import { FAILURE_MESSAGE, classifyAiError, cleanGeminiKey, modelChain, withRetry } from "@/lib/ai/retry";

/** Models for this household: Settings → Household → AI model, unless GEMINI_MODEL is set in Vercel. */
export function modelsFor(session: AppSession) {
  return modelChain(session.household.ai_model, process.env.GEMINI_MODEL);
}

export class AiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Resolves the household's own key (if set) or the app's server key. Never sent to the browser. */
async function resolveApiKey(session: AppSession): Promise<string> {
  if (session.household.has_custom_ai_key) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("household_secrets")
      .select("gemini_key_ciphertext")
      .eq("household_id", session.household.id)
      .single();
    if (data?.gemini_key_ciphertext) return cleanGeminiKey(decryptSecret(data.gemini_key_ciphertext));
  }
  const key = cleanGeminiKey(process.env.GEMINI_API_KEY);
  if (!key) throw new AiError("AI isn't set up yet. Add a Gemini key in Settings → Household.", 503);
  return key;
}

export async function getGemini(session: AppSession) {
  return new GoogleGenAI({ apiKey: await resolveApiKey(session) });
}

/** Enforces the household's daily AI request cap. */
export async function assertQuota(session: AppSession) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await session.supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("household_id", session.household.id)
    .gte("created_at", start.toISOString());
  if ((count ?? 0) >= session.household.ai_daily_limit) {
    throw new AiError(`Daily AI limit reached (${session.household.ai_daily_limit} requests). It resets at midnight UTC.`, 429);
  }
}

export async function recordUsage(
  session: AppSession,
  feature: string,
  usedMedicalContext: boolean,
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number },
) {
  await session.supabase.from("ai_usage").insert({
    household_id: session.household.id,
    user_id: session.userId,
    feature,
    used_medical_context: usedMedicalContext,
    input_tokens: usage?.promptTokenCount ?? null,
    output_tokens: usage?.candidatesTokenCount ?? null,
  });
}

/**
 * The one way the app calls Gemini: household model choice, retries with
 * fallback, the person's language added to the system instruction, and a
 * clear AiError when everything fails.
 */
export async function generate(session: AppSession, request: Omit<GenerateContentParameters, "model">): Promise<GenerateContentResponse & { modelUsed: string }> {
  const ai = await getGemini(session);
  const lang = aiLanguageLine(session);
  const sys = request.config?.systemInstruction;
  const config = { ...request.config, systemInstruction: typeof sys === "string" || sys == null ? [sys, lang].filter(Boolean).join("\n\n") || undefined : sys };
  try {
    const { result, model } = await withRetry(modelsFor(session), async (model) => {
      const res = await ai.models.generateContent({ ...request, model, config });
      if (!res.text?.trim()) throw Object.assign(new Error("Empty response"), { name: "EmptyResponse" });
      return res;
    });
    return Object.assign(result, { modelUsed: model });
  } catch (err) {
    if (err instanceof AiError) throw err;
    const c = classifyAiError(err);
    throw new AiError(FAILURE_MESSAGE[c.kind], c.kind === "quota" ? 429 : c.kind === "key" ? 401 : 502);
  }
}
