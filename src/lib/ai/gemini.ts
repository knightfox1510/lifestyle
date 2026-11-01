import "server-only";

import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import type { AppSession } from "@/lib/session";

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

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
    if (data?.gemini_key_ciphertext) return decryptSecret(data.gemini_key_ciphertext);
  }
  const key = process.env.GEMINI_API_KEY;
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
