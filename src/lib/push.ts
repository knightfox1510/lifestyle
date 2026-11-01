import "server-only";

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export type PushMessage = { kind: string; refKey: string; title: string; body?: string; url?: string };

/**
 * Sends a notification to every device of a user, at most once per refKey
 * (the notification_log unique constraint makes it idempotent, so a cron
 * that runs twice never double-notifies). Expired subscriptions are removed.
 * Must be called with the service-role client.
 */
export async function notifyUser(admin: SupabaseClient, userId: string, msg: PushMessage): Promise<"sent" | "duplicate" | "no-devices" | "not-configured"> {
  if (!configure()) return "not-configured";
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!subs?.length) return "no-devices";

  const { error: dupe } = await admin
    .from("notification_log")
    .insert({ user_id: userId, kind: msg.kind, ref_key: msg.refKey, title: msg.title, body: msg.body ?? null, url: msg.url ?? null });
  if (dupe) return "duplicate";

  const payload = JSON.stringify({ title: msg.title, body: msg.body ?? "", url: msg.url ?? "/", tag: msg.refKey });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
        await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.warn("push failed", status);
      }
    }),
  );
  return "sent";
}

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
