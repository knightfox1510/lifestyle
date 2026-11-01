import "server-only";

import { NextResponse } from "next/server";
import type { Part } from "@google/genai";
import type { z } from "zod";
import type { AppSession } from "@/lib/session";
import { AiError, DEFAULT_MODEL, assertQuota, getGemini, recordUsage } from "@/lib/ai/gemini";
import { toGeminiSchema } from "@/lib/ai/schemas";
import { aiLanguageLine } from "@/lib/i18n/server";

/** Calls Gemini for structured JSON, enforces the household quota, logs usage and validates the result. */
export async function runJson<S extends z.ZodType>(
  session: AppSession,
  opts: {
    feature: string;
    schema: S;
    parts: Part[];
    system?: string;
    temperature?: number;
    usedHealth?: boolean;
  },
): Promise<z.infer<S>> {
  await assertQuota(session);
  const ai = await getGemini(session);
  const res = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: [{ role: "user", parts: opts.parts }],
    config: {
      systemInstruction: [opts.system, aiLanguageLine(session)].filter(Boolean).join("\n\n") || undefined,
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(opts.schema),
      temperature: opts.temperature ?? 0.4,
    },
  });
  await recordUsage(session, opts.feature, opts.usedHealth ?? false, res.usageMetadata);
  let json: unknown;
  try {
    json = JSON.parse(res.text ?? "");
  } catch {
    throw new AiError("The AI response couldn't be read. Try again.", 502);
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new AiError("The AI response was incomplete. Try again.", 502);
  return parsed.data;
}

/** Wraps a route handler so AI/validation errors become friendly JSON responses. */
export async function aiHandler(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err && typeof err === "object" && "digest" in err) throw err; // let Next redirects through
    console.error("AI route failed", err);
    return NextResponse.json({ error: "The AI request failed. Try again in a moment." }, { status: 502 });
  }
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Reads an uploaded image from multipart form data as a Gemini inline part. */
export async function imagePart(file: FormDataEntryValue | null): Promise<Part | null> {
  if (!file || typeof file === "string") return null;
  if (!IMAGE_TYPES.includes(file.type)) throw new AiError("Use a JPG, PNG, WEBP or HEIC photo.");
  if (file.size > MAX_IMAGE_BYTES) throw new AiError("Photo is too large (max 8 MB).");
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  return { inlineData: { data, mimeType: file.type } };
}
