"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { insertWater, waterTarget, waterToday } from "@/lib/water";
import { getT } from "@/lib/i18n/server";

/** One-tap water logging (Home widget, food diary). */
export async function logWater(ml: number): Promise<ActionResult> {
  const parsed = z.number().int().min(50).max(1500).safeParse(ml);
  if (!parsed.success) return { error: "Invalid amount." };
  const session = await getSession();
  if (!(await insertWater(session, parsed.data))) return { error: "Couldn't save." };
  const [{ ml: total }, target] = await Promise.all([waterToday(session), waterTarget(session)]);
  revalidatePath("/", "layout");
  const t = await getT(session);
  return { ok: true, message: `+${parsed.data} ml · ${t("{ml} / {target} ml today", { ml: total, target })}` };
}
