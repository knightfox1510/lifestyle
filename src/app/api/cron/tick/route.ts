import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders";

export const maxDuration = 60;

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * Sends due reminders. Call every 5 minutes (Supabase pg_cron + pg_net, or
 * Vercel Cron on Pro) with `Authorization: Bearer <CRON_SECRET>`. Safe to call
 * more often: every notification is sent at most once.
 */
async function handle(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await runReminders();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
