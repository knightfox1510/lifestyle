"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { insertWater, waterAccess, waterTarget, waterToday } from "@/lib/water";
import { getT } from "@/lib/i18n/server";
import { addDays, todayIn, zonedIso } from "@/lib/dates";

/** One-tap water logging (Home widget, food diary), today or for an earlier day (logged at 1 pm that day). */
export async function logWater(ml: number, day?: string, ownerId?: string, atIso?: string): Promise<ActionResult> {
  const parsed = z.number().int().min(50).max(1500).safeParse(ml);
  if (!parsed.success) return { error: "Invalid amount." };
  const session = await getSession();
  const owner = ownerId && z.uuid().safeParse(ownerId).success ? ownerId : session.userId;
  const name = session.members.find((m) => m.user_id === owner)?.display_name ?? "them";
  if (waterAccess(session, owner) !== "write") return { error: `${name} hasn't let you log their water. They can allow it in Settings → Sharing → Water intake.` };
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const past = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day < today && day >= addDays(today, -366) ? day : null;
  // A tap saved offline and sent later keeps its time (within the last 3 days).
  const queued = atIso && Date.parse(atIso) <= Date.now() && Date.parse(atIso) > Date.now() - 3 * 864e5 ? new Date(atIso).toISOString() : null;
  const id = await insertWater(session, parsed.data, queued ?? (past ? zonedIso(past, "13:00", tz) : undefined), owner);
  if (!id) return { error: owner === session.userId ? "Couldn't save." : `Couldn't save ${name}'s water. Check Settings → Sharing → Water intake on their phone.` };
  const [{ ml: total }, target] = await Promise.all([waterToday(session, owner, past ?? undefined), waterTarget(session, owner)]);
  revalidatePath("/", "layout");
  const t = await getT(session);
  const forWhom = owner === session.userId ? "" : ` ${t("for {name}", { name })}`;
  return { ok: true, id, message: `+${parsed.data} ml${forWhom} · ${t(past ? "{ml} / {target} ml that day" : "{ml} / {target} ml today", { ml: total, target })}` };
}
