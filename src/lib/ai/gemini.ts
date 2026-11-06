import "server-only";

import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import type { AppSession } from "@/lib/session";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { aiLanguageLine } from "@/lib/i18n/server";
import { FAILURE_MESSAGE, classifyAiError, cleanGeminiKey, modelChain, withRetry } from "@/lib/ai/retry";
import { profileFor, type Thinking } from "@/lib/ai/profile";

/**
 * Models for this household: Settings → Household → AI model, unless
 * GEMINI_MODEL is set in Vercel. "Best" (Pro, about 4× the price) is used only
 * for the features that reason over health data; everyday ones use Flash.
 */
export function modelsFor(session: AppSession, deep = true) {
  return modelChain(deep ? session.household.ai_model : "standard", process.env.GEMINI_MODEL);
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

/** Enforces the household's daily AI request cap (answers reused from the cache don't count). */
export async function assertQuota(session: AppSession) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const base = () => session.supabase.from("ai_usage").select("id", { count: "exact", head: true }).eq("household_id", session.household.id).gte("created_at", start.toISOString());
  const first = await base().eq("from_cache", false);
  // Older database without the column: count everything.
  const count = first.error ? (await base()).count : first.count;
  if ((count ?? 0) >= session.household.ai_daily_limit) {
    throw new AiError(`Daily AI limit reached (${session.household.ai_daily_limit} requests). It resets at midnight UTC.`, 429);
  }
}

type Usage = { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number; toolUsePromptTokenCount?: number };

/**
 * Logs one AI request with everything Google bills: input (including search
 * results fed back in), output, hidden thinking, cached input, web searches,
 * the model and how many tries it took. Falls back to the original columns on
 * a database that hasn't been updated yet.
 */
export async function recordUsage(
  session: AppSession,
  feature: string,
  usedMedicalContext: boolean,
  res?: { usageMetadata?: Usage; modelUsed?: string; attempts?: number; candidates?: { groundingMetadata?: { webSearchQueries?: string[] } }[] } | Usage,
  opts: { fromCache?: boolean } = {},
) {
  const full = res && ("usageMetadata" in res || "modelUsed" in res) ? (res as { usageMetadata?: Usage; modelUsed?: string; attempts?: number; candidates?: { groundingMetadata?: { webSearchQueries?: string[] } }[] }) : { usageMetadata: res as Usage | undefined };
  const u = full.usageMetadata;
  const row = {
    household_id: session.household.id,
    user_id: session.userId,
    feature,
    used_medical_context: usedMedicalContext,
    input_tokens: u ? (u.promptTokenCount ?? 0) + (u.toolUsePromptTokenCount ?? 0) : null,
    output_tokens: u?.candidatesTokenCount ?? null,
  };
  const { error } = await session.supabase.from("ai_usage").insert({
    ...row,
    thinking_tokens: u?.thoughtsTokenCount ?? null,
    cached_tokens: u?.cachedContentTokenCount ?? null,
    search_queries: "candidates" in full ? (full.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ?? null) : null,
    model: "modelUsed" in full ? (full.modelUsed ?? null) : null,
    attempts: "attempts" in full ? (full.attempts ?? 1) : 1,
    from_cache: Boolean(opts.fromCache),
  });
  if (error && !opts.fromCache) await session.supabase.from("ai_usage").insert(row);
}

/**
 * The one way the app calls Gemini: household model choice, retries with
 * fallback, the person's language added to the system instruction, and a
 * clear AiError when everything fails.
 */
/** Gemini 3 models (and Google's "-latest" aliases, which point at them) accept a thinking level. */
const takesThinkingLevel = (model: string) => /gemini-(3|[a-z-]*latest)/.test(model);

export type GenerateOptions = {
  /** Wall-clock time (ms since epoch) by which the answer must be back; retries stop before it. */
  deadline?: number;
  /** Light thinking for long, mostly-transcription jobs (documents, menus): much faster on Pro. */
  quick?: boolean;
  /** The feature (see lib/ai/profile): picks the model, thinking and photo detail. */
  feature?: string;
};

/** Thinking setting for a model: Gemini 3 takes a level (Pro has no "minimal"); older models a token budget. */
export function thinkingConfig(model: string, level: Thinking) {
  if (level === "high") return {};
  if (takesThinkingLevel(model)) return { thinkingConfig: { thinkingLevel: level === "minimal" && !/pro/.test(model) ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW } };
  if (/2\.5/.test(model)) return { thinkingConfig: { thinkingBudget: level === "minimal" ? (/pro/.test(model) ? 128 : 0) : 1024 } };
  return {};
}

/** Leaves a few seconds of the route's maxDuration for saving and replying. */
export function deadlineFor(maxDurationSeconds: number) {
  return Date.now() + (maxDurationSeconds - 8) * 1000;
}

export async function generate(
  session: AppSession,
  request: Omit<GenerateContentParameters, "model">,
  opts: GenerateOptions = {},
): Promise<GenerateContentResponse & { modelUsed: string; attempts: number }> {
  const ai = await getGemini(session);
  const lang = aiLanguageLine(session);
  const sys = request.config?.systemInstruction;
  const config = { ...request.config, systemInstruction: typeof sys === "string" || sys == null ? [sys, lang].filter(Boolean).join("\n\n") || undefined : sys };
  const profile = opts.feature ? profileFor(opts.feature) : null;
  // Thinking is billed as output: everyday features get little of it.
  const level: Thinking = profile ? (opts.quick && profile.thinking === "high" ? "low" : profile.thinking) : opts.quick ? "low" : "high";
  const hasImage = JSON.stringify(request.contents ?? "").includes('"inlineData"');
  const media = profile?.media === "medium" && hasImage ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM } : {};
  let attempts = 0;
  try {
    const { result, model } = await withRetry(modelsFor(session, profile?.deep ?? true), async (model, signal) => {
      attempts++;
      const thinking = config.thinkingConfig ? {} : thinkingConfig(model, level);
      const res = await ai.models.generateContent({ ...request, model, config: { ...config, ...thinking, ...media, ...(signal ? { abortSignal: signal } : {}) } });
      if (!res.text?.trim()) throw Object.assign(new Error("Empty response"), { name: "EmptyResponse" });
      return res;
    }, { deadline: opts.deadline ?? deadlineFor(60) });
    return Object.assign(result, { modelUsed: model, attempts });
  } catch (err) {
    if (err instanceof AiError) throw err;
    const c = classifyAiError(err);
    throw new AiError(FAILURE_MESSAGE[c.kind], c.kind === "quota" ? 429 : c.kind === "key" ? 401 : c.kind === "timeout" ? 504 : 502);
  }
}
