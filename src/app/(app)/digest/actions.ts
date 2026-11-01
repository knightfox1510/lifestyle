"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { generateDigest } from "@/lib/digest";
import { AiError } from "@/lib/ai/gemini";
import type { ActionResult } from "@/lib/types";

export async function generateDigestNow(): Promise<ActionResult> {
  try {
    await generateDigest(await getSession());
  } catch (e) {
    return { error: e instanceof AiError ? e.message : "Couldn't generate the summary." };
  }
  revalidatePath("/digest");
  return { ok: true };
}
