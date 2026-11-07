"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { generateDigest } from "@/lib/digest";
import { AiError } from "@/lib/ai/gemini";
import type { ActionResult } from "@/lib/types";

/** Rewrites this week's summary: from the numbers (free), or with AI. */
export async function generateDigestNow(ai = false): Promise<ActionResult> {
  try {
    await generateDigest(await getSession(), { ai });
  } catch (e) {
    return { error: e instanceof AiError ? e.message : "Couldn't generate the summary." };
  }
  revalidatePath("/digest");
  return { ok: true };
}
