"use server";

import { z } from "zod";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/push";
import { isLang, makeT } from "@/lib/i18n/core";
import { todayIn } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";

const EMOJI = ["👏", "❤️", "💪", "🎉"] as const;

/** Send a cheer to a household member, delivered as a push in their language. Max 10 a day to the same person. */
export async function sendCheer(toUser: string, emoji: string): Promise<ActionResult> {
  const p = z.object({ to: z.uuid(), emoji: z.enum(EMOJI) }).safeParse({ to: toUser, emoji });
  if (!p.success) return { error: "Invalid cheer." };
  const session = await getSession();
  const to = session.members.find((m) => m.user_id === p.data.to);
  if (!to || to.user_id === session.userId) return { error: "You can only cheer someone in your household." };
  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await session.supabase.from("cheers").select("id", { count: "exact", head: true }).eq("from_user", session.userId).eq("to_user", to.user_id).gte("created_at", since);
  if ((count ?? 0) >= 10) return { error: "That's plenty of cheers for today." };
  const { data, error } = await session.supabase.from("cheers").insert({ household_id: session.household.id, to_user: to.user_id, emoji: p.data.emoji }).select("id").single();
  if (error || !data) return { error: "Couldn't send." };
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin.from("profiles").select("language").eq("id", to.user_id).maybeSingle();
    const tr = makeT(isLang(prof?.language) ? prof!.language : "en");
    await notifyUser(admin, to.user_id, { kind: "cheer", refKey: `cheer:${data.id}`, title: `${p.data.emoji} ${tr("{name} cheered you on", { name: session.me.display_name })}`, body: tr("Open Hearth to see your day."), url: "/" });
  } catch {
    // Push is best effort; the cheer still shows on their Home.
  }
  return { ok: true, message: `${p.data.emoji} → ${to.display_name}` };
}

/** Marks the day closed: tells the partner (if they want updates) so they can send a cheer. */
export async function announceDayClosed(): Promise<ActionResult> {
  const session = await getSession();
  const partner = session.partner;
  if (!partner) return { ok: true };
  try {
    const admin = createAdminClient();
    const [{ data: prefs }, { data: prof }] = await Promise.all([
      admin.from("notification_prefs").select("partner_updates").eq("user_id", partner.user_id).maybeSingle(),
      admin.from("profiles").select("language").eq("id", partner.user_id).maybeSingle(),
    ]);
    if (prefs && prefs.partner_updates === false) return { ok: true };
    const tr = makeT(isLang(prof?.language) ? prof!.language : "en");
    await notifyUser(admin, partner.user_id, {
      kind: "partner_closed",
      refKey: `closed:${session.userId}:${todayIn(session.profile.timezone)}`,
      title: `✨ ${tr("{name} closed their day", { name: session.me.display_name })}`,
      body: tr("Send a 👏 from Home."),
      url: "/",
    });
  } catch {
    // best effort
  }
  return { ok: true };
}
