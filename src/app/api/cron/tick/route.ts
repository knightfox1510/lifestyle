import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders";
import { cleanupFoodPhotos } from "@/lib/photo-cleanup";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const now = new Date();
  const summary = await runReminders(now);
  // Once a night (around 03:00–03:35 UTC, which the daily Vercel cron and the 5-minute job both hit): tidy unused meal photos.
  let photosRemoved = 0;
  if (now.getUTCHours() === 3 && now.getUTCMinutes() < 35) photosRemoved = await cleanupFoodPhotos(createAdminClient(), now).catch(() => 0);
  return NextResponse.json({ ok: true, ...summary, photosRemoved });
}

export const GET = handle;
export const POST = handle;
