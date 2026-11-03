import "server-only";

import { NextResponse } from "next/server";
import type { Part } from "@google/genai";
import type { z } from "zod";
import type { AppSession } from "@/lib/session";
import { AiError, assertQuota, deadlineFor, generate, recordUsage } from "@/lib/ai/gemini";
import { clampToSchema, toGeminiSchema } from "@/lib/ai/schemas";

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
    /** The route's maxDuration in seconds (default 60); the AI stops in time to reply. */
    maxDuration?: number;
    /** Light thinking, for long transcription-like jobs. */
    quick?: boolean;
    /** Let the model look things up with Google Search (e.g. a restaurant's current menu). */
    search?: boolean;
  },
): Promise<z.infer<S>> {
  const deadline = deadlineFor(opts.maxDuration ?? 60);
  await assertQuota(session);
  const request = {
    contents: [{ role: "user", parts: opts.parts }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(opts.schema),
      temperature: opts.temperature ?? 0.4,
      ...(opts.search ? { tools: [{ googleSearch: {} }] } : {}),
    },
  };
  // A malformed or incomplete JSON answer gets one more try before giving up.
  for (let attempt = 0; ; attempt++) {
    // A second try only if there's clearly time for it.
    if (attempt > 0 && deadline - Date.now() < 20_000) throw new AiError("The AI response was incomplete. Try again.", 502);
    const res = await generate(session, request, { deadline, quick: opts.quick });
    if (attempt === 0) await recordUsage(session, opts.feature, opts.usedHealth ?? false, res.usageMetadata);
    let json: unknown = undefined;
    try {
      json = clampToSchema(JSON.parse(res.text ?? ""), opts.schema);
    } catch {
      /* retried below */
    }
    const parsed = opts.schema.safeParse(json);
    if (parsed.success) return parsed.data;
    console.error(`runJson ${opts.feature}: unusable answer from ${res.modelUsed}`, parsed.error?.issues?.slice(0, 3));
    if (attempt >= 1) throw new AiError(json === undefined ? "The AI response couldn't be read. Try again." : "The AI response was incomplete. Try again.", 502);
  }
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
