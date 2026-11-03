"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { insertWater, waterTarget, waterToday } from "@/lib/water";
import { getT } from "@/lib/i18n/server";
import { addDays, todayIn, zonedIso } from "@/lib/dates";

/** One-tap water logging (Home widget, food diary), today or for an earlier day (logged at 1 pm that day). */
export async function logWater(ml: number, day?: string): Promise<ActionResult> {
  const parsed = z.number().int().min(50).max(1500).safeParse(ml);
  if (!parsed.success) return { error: "Invalid amount." };
  const session = await getSession();
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const past = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day < today && day >= addDays(today, -366) ? day : null;
  const id = await insertWater(session, parsed.data, past ? zonedIso(past, "13:00", tz) : undefined);
  if (!id) return { error: "Couldn't save." };
  const [{ ml: total }, target] = await Promise.all([waterToday(session, session.userId, past ?? undefined), waterTarget(session)]);
  revalidatePath("/", "layout");
  const t = await getT(session);
  return { ok: true, id, message: `+${parsed.data} ml · ${t(past ? "{ml} / {target} ml that day" : "{ml} / {target} ml today", { ml: total, target })}` };
}
