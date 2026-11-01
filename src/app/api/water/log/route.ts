import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { insertWater, waterTarget, waterToday } from "@/lib/water";
import { getT } from "@/lib/i18n/server";

/**
 * Logs water from a notification button (called by the service worker with
 * the signed-in cookies). Same-origin only.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ ml: z.number().int().min(50).max(1500) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  let session;
  try {
    session = await getSession();
  } catch {
    return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  }
  if (!(await insertWater(session, parsed.data.ml))) return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  const [{ ml }, target] = await Promise.all([waterToday(session), waterTarget(session)]);
  const t = await getT(session);
  return NextResponse.json({ ok: true, title: `💧 ${t("+{ml} ml logged", { ml: parsed.data.ml })}`, message: t("{ml} / {target} ml today", { ml, target }) });
}
