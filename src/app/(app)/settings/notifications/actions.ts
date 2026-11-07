"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser, pushConfigured } from "@/lib/push";
import type { ActionResult } from "@/lib/types";

const subSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

export async function savePushSubscription(sub: unknown, userAgent: string): Promise<ActionResult> {
  const parsed = subSchema.safeParse(sub);
  if (!parsed.success) return { error: "Invalid subscription" };
  const session = await getSession();
  // The endpoint is unique per device; re-subscribing moves it to this user.
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await session.supabase.from("push_subscriptions").insert({
    user_id: session.userId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) return { error: "Couldn't save this device." };
  revalidatePath("/settings/notifications");
  return { ok: true, message: "Notifications are on for this device." };
}

export async function removePushSubscription(endpoint: string) {
  const session = await getSession();
  await session.supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", session.userId);
  revalidatePath("/settings/notifications");
}

export async function removeDevice(id: string) {
  const session = await getSession();
  await session.supabase.from("push_subscriptions").delete().eq("id", id).eq("user_id", session.userId);
  revalidatePath("/settings/notifications");
}

export async function sendTestNotification(): Promise<ActionResult> {
  if (!pushConfigured()) return { error: "Push isn't configured on the server (VAPID keys missing)." };
  const session = await getSession();
  const res = await notifyUser(createAdminClient(), session.userId, {
    kind: "test",
    refKey: `test:${Date.now()}`,
    title: "Hearth notifications work 🎉",
    body: "You'll get reminders here.",
    url: "/settings/notifications",
  });
  return res === "sent" ? { ok: true, message: "Sent. It should appear in a few seconds." } : { error: res === "no-devices" ? "Turn on notifications for this device first." : "Couldn't send." };
}

const time = z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(/^\d{2}:\d{2}$/).nullable());
const prefsSchema = z.object({
  medicines: z.boolean(),
  fitness: z.boolean(),
  expiries: z.boolean(),
  renewals: z.boolean(),
  maintenance: z.boolean(),
  child: z.boolean(),
  digest: z.boolean(),
  digest_ai: z.boolean(),
  occasions: z.boolean(),
  travel: z.boolean(),
  water: z.boolean(),
  close_day: z.boolean(),
  close_day_time: z.string().regex(/^\d{2}:\d{2}$/),
  partner_updates: z.boolean(),
  water_target_ml: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(500).max(6000).nullable()),
  water_interval_min: z.coerce.number().int().min(30).max(360),
  water_start: z.string().regex(/^\d{2}:\d{2}$/),
  water_end: z.string().regex(/^\d{2}:\d{2}$/),
  daily_hour: z.coerce.number().int().min(0).max(23),
  quiet_start: time,
  quiet_end: time,
});

export async function saveNotificationPrefs(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const flags = ["medicines", "fitness", "expiries", "renewals", "maintenance", "child", "digest", "digest_ai", "occasions", "travel", "water", "close_day", "partner_updates"];
  const parsed = prefsSchema.safeParse({
    ...Object.fromEntries(form),
    ...Object.fromEntries(flags.map((f) => [f, form.get(f) === "on"])),
  });
  if (!parsed.success) return { error: "Check the times and water settings." };
  if (parsed.data.water_start >= parsed.data.water_end) return { error: "Water reminders must start before they end." };
  const session = await getSession();
  let { error } = await session.supabase.from("notification_prefs").upsert({ ...parsed.data, user_id: session.userId }, { onConflict: "user_id" });
  if (error) {
    // Older database without the AI-summary column: save the rest.
    const { digest_ai: _skip, ...rest } = parsed.data;
    void _skip;
    ({ error } = await session.supabase.from("notification_prefs").upsert({ ...rest, user_id: session.userId }, { onConflict: "user_id" }));
  }
  if (error) return { error: "Couldn't save." };
  revalidatePath("/settings/notifications");
  return { ok: true, message: "Saved." };
}
