import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/push";
import { addDays, dayOfWeek, localDate, localTime } from "@/lib/dates";
import { isScheduledOn } from "@/modules/medicines/logic";
import { daysUntil } from "@/modules/pantry/match";
import { generateDigest, weekStart } from "@/lib/digest";
import { serviceSession } from "@/lib/service-session";
import type { FitnessClass, Medicine, NotificationPrefs, Profile } from "@/lib/types";
import { WINDOW_MINUTES, inQuietHours, inWindow, shouldRemind, toMinutes } from "@/modules/notifications/timing";

const DEFAULT_PREFS: Omit<NotificationPrefs, "user_id"> = {
  medicines: true,
  fitness: true,
  expiries: true,
  renewals: true,
  maintenance: true,
  child: true,
  digest: true,
  daily_hour: 9,
  quiet_start: null,
  quiet_end: null,
};

type Summary = { users: number; sent: number; digests: number; errors: number };

export async function runReminders(now = new Date()): Promise<Summary> {
  const admin = createAdminClient();
  const summary: Summary = { users: 0, sent: 0, digests: 0, errors: 0 };

  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  const userIds = [...new Set((subs ?? []).map((s: { user_id: string }) => s.user_id))];
  if (!userIds.length) return summary;

  const [{ data: profiles }, { data: prefRows }] = await Promise.all([
    admin.from("profiles").select("*").in("id", userIds),
    admin.from("notification_prefs").select("*").in("user_id", userIds),
  ]);
  const prefsBy = new Map((prefRows ?? []).map((p: NotificationPrefs) => [p.user_id, p]));
  const householdIds = [...new Set((profiles ?? []).map((p: Profile) => p.active_household_id).filter(Boolean))] as string[];
  const { data: modRows } = await admin.from("household_modules").select("household_id, module_key, enabled").in("household_id", householdIds);
  const enabled = (hid: string, key: string) => (modRows ?? []).some((m: { household_id: string; module_key: string; enabled: boolean }) => m.household_id === hid && m.module_key === key && m.enabled);

  for (const profile of (profiles ?? []) as Profile[]) {
    const hid = profile.active_household_id;
    if (!hid) continue;
    summary.users += 1;
    try {
      const sent = await remindUser(admin, profile, hid, { ...DEFAULT_PREFS, ...(prefsBy.get(profile.id) ?? {}) }, (k) => enabled(hid, k), now);
      summary.sent += sent.sent;
      summary.digests += sent.digests;
    } catch (err) {
      summary.errors += 1;
      console.error("reminders failed for user", profile.id, err);
    }
  }
  return summary;
}

async function remindUser(
  admin: SupabaseClient,
  profile: Profile,
  hid: string,
  prefs: Omit<NotificationPrefs, "user_id">,
  on: (key: string) => boolean,
  now: Date,
) {
  const tz = profile.timezone;
  const today = localDate(now, tz);
  const time = localTime(now, tz);
  const quiet = inQuietHours(time, prefs.quiet_start, prefs.quiet_end);
  const result = { sent: 0, digests: 0 };
  const send = async (kind: string, refKey: string, title: string, body: string, url: string) => {
    if ((await notifyUser(admin, profile.id, { kind, refKey, title, body, url })) === "sent") result.sent += 1;
  };

  // Medicine doses: always (even in quiet hours: they're time-critical).
  if (prefs.medicines && on("medicines")) {
    const [{ data: meds }, { data: doses }] = await Promise.all([
      admin.from("medicines").select("*").eq("owner_id", profile.id).eq("active", true),
      admin.from("medicine_doses").select("medicine_id, scheduled_time").eq("owner_id", profile.id).eq("scheduled_date", today),
    ]);
    const due = ((meds ?? []) as Medicine[]).flatMap((m) =>
      isScheduledOn(m, today) ? m.times.filter((t) => inWindow(time, toMinutes(t)) && !(doses ?? []).some((d: { medicine_id: string; scheduled_time: string | null }) => d.medicine_id === m.id && d.scheduled_time === t)).map((t) => ({ m, t })) : [],
    );
    for (const { m, t } of due) {
      await send("medicine", `med:${m.id}:${today}:${t}`, `💊 Time for ${m.name}`, `${m.dose_amount} ${m.dose_unit}${m.instructions ? ` · ${m.instructions}` : ""} (${t})`, "/medicines");
    }
  }

  if (quiet) return result;

  // Fitness classes, N minutes before.
  if (prefs.fitness && on("fitness")) {
    const { data: classes } = await admin.from("fitness_classes").select("*").eq("owner_id", profile.id).eq("active", true).not("remind_minutes_before", "is", null);
    for (const c of (classes ?? []) as FitnessClass[]) {
      const startMin = toMinutes(c.start_time);
      const remindAt = startMin - (c.remind_minutes_before ?? 0);
      // If the reminder time falls on the previous day, check tomorrow's schedule.
      const classDay = remindAt < 0 ? addDays(today, 1) : today;
      if (!c.days_of_week.includes(dayOfWeek(classDay))) continue;
      if (inWindow(time, remindAt)) {
        await send("fitness", `fit:${c.id}:${classDay}`, `🏋️ ${c.name} at ${c.start_time}`, `${c.duration_minutes} min${c.location ? ` · ${c.location}` : ""}`, "/fitness");
      }
    }
  }

  // Daily digest of due things, at the person's chosen hour.
  const dailyNow = inWindow(time, prefs.daily_hour * 60, WINDOW_MINUTES);
  if (dailyNow) {
    if (prefs.expiries && on("pantry")) {
      const { data } = await admin.from("pantry_items").select("name, expires_on").eq("household_id", hid).is("used_up_at", null).lte("expires_on", addDays(today, 1)).gte("expires_on", today);
      if (data?.length) {
        await send("pantry", `pantry:${hid}:${today}`, `⏳ ${data.length} item${data.length === 1 ? "" : "s"} expiring`, data.map((p: { name: string }) => p.name).slice(0, 6).join(", "), "/pantry");
      }
    }
    if (prefs.renewals && on("documents")) {
      const { data } = await admin.from("documents").select("id, title, expires_on, remind_days_before, owner_id, scope").eq("household_id", hid).not("expires_on", "is", null);
      for (const d of (data ?? []) as { id: string; title: string; expires_on: string; remind_days_before: number; owner_id: string; scope: string }[]) {
        if (d.scope !== "household" && d.owner_id !== profile.id) continue;
        const left = daysUntil(d.expires_on, today)!;
        if (shouldRemind(left, d.remind_days_before)) {
          await send("document", `doc:${d.id}:${d.expires_on}:${left}`, left < 0 ? `🛂 ${d.title} has expired` : `🛂 ${d.title} expires in ${left} day${left === 1 ? "" : "s"}`, `Expiry ${d.expires_on}. Start the renewal.`, "/documents");
        }
      }
    }
    if (prefs.renewals && on("subscriptions")) {
      const { data } = await admin.from("subscriptions").select("id, name, next_renewal_on, cost, currency").eq("household_id", hid).eq("active", true).not("next_renewal_on", "is", null);
      for (const s of (data ?? []) as { id: string; name: string; next_renewal_on: string; cost: number | null; currency: string }[]) {
        const left = daysUntil(s.next_renewal_on, today)!;
        if (left === 3 || left === 0) {
          await send("subscription", `sub:${s.id}:${s.next_renewal_on}:${left}`, `🔁 ${s.name} renews ${left === 0 ? "today" : "in 3 days"}`, s.cost != null ? `${s.currency} ${s.cost}` : "Cancel it if you don't need it.", "/subscriptions");
        }
      }
    }
    if (prefs.maintenance && on("maintenance")) {
      const { data } = await admin.from("maintenance_tasks").select("id, title, next_due_on, remind_days_before").eq("household_id", hid).not("next_due_on", "is", null);
      for (const t of (data ?? []) as { id: string; title: string; next_due_on: string; remind_days_before: number }[]) {
        const left = daysUntil(t.next_due_on, today)!;
        if (left === t.remind_days_before || left === 0 || left === -1) {
          await send("maintenance", `maint:${t.id}:${t.next_due_on}:${left}`, `🛠️ ${t.title} ${left < 0 ? "is overdue" : left === 0 ? "is due today" : `is due in ${left} days`}`, "Mark it done in Hearth when it's finished.", "/maintenance");
        }
      }
    }
    if (prefs.child && on("child")) {
      const { data } = await admin.from("vaccinations").select("id, vaccine, due_on, dependent_id").eq("household_id", hid).is("given_on", null).not("due_on", "is", null);
      for (const v of (data ?? []) as { id: string; vaccine: string; due_on: string }[]) {
        const left = daysUntil(v.due_on, today)!;
        if (left === 7 || left === 1 || left === 0) {
          await send("vaccination", `vac:${v.id}:${left}`, `💉 ${v.vaccine} due ${left === 0 ? "today" : left === 1 ? "tomorrow" : "in a week"}`, "Book the paediatrician visit.", "/child/health");
        }
      }
    }
  }

  // Weekly AI digest: Sunday 18:00 local.
  if (prefs.digest && dayOfWeek(today) === 0 && inWindow(time, 18 * 60)) {
    const ws = weekStart(today);
    const { data: existing } = await admin.from("digests").select("id").eq("user_id", profile.id).eq("week_start", ws).maybeSingle();
    if (!existing) {
      const session = await serviceSession(profile.id);
      if (session) {
        try {
          await generateDigest(session);
          result.digests += 1;
          await send("digest", `digest:${ws}`, "📬 Your weekly summary is ready", "Wins, things to watch and what's coming up.", "/digest");
        } catch (err) {
          console.warn("digest failed", profile.id, (err as Error).message);
        }
      }
    }
  }
  return result;
}
