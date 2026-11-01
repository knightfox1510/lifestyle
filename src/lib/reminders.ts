import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/push";
import { addDays, dayOfWeek, localDate, localTime, startOfLocalDayIso } from "@/lib/dates";
import { isScheduledOn } from "@/modules/medicines/logic";
import { nextOccurrence } from "@/modules/occasions/logic";
import type { Occasion } from "@/lib/types";
import { daysUntil } from "@/modules/pantry/match";
import { generateDigest, weekStart } from "@/lib/digest";
import { loadDays, waterSettings } from "@/lib/today";
import { serviceSession } from "@/lib/service-session";
import type { FitnessClass, Medicine, NotificationPrefs, Profile } from "@/lib/types";
import { makeT, isLang } from "@/lib/i18n/core";
import { WINDOW_MINUTES, dueWaterSlot, inQuietHours, inWindow, shouldRemind, toMinutes } from "@/modules/notifications/timing";

const DEFAULT_PREFS: Omit<NotificationPrefs, "user_id"> = {
  medicines: true,
  fitness: true,
  expiries: true,
  renewals: true,
  maintenance: true,
  child: true,
  digest: true,
  occasions: true,
  travel: true,
  water: false,
  water_target_ml: null,
  water_interval_min: 120,
  water_start: "08:00",
  water_end: "19:30",
  close_day: true,
  close_day_time: "21:00",
  partner_updates: true,
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
  // Notification text in the person's app language.
  const tr = makeT(isLang(profile.language) ? profile.language : "en");
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
      await send("medicine", `med:${m.id}:${today}:${t}`, `💊 ${tr("Time for {name}", { name: m.name })}`, `${m.dose_amount} ${m.dose_unit}${m.instructions ? ` · ${m.instructions}` : ""} (${t})`, "/medicines");
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
        await send("fitness", `fit:${c.id}:${classDay}`, `🏋️ ${tr("{name} at {time}", { name: c.name, time: c.start_time.slice(0, 5) })}`, `${c.duration_minutes} min${c.location ? ` · ${c.location}` : ""}`, "/fitness");
      }
    }
  }

  // Water: at each slot between start and end, only if behind pace.
  if (prefs.water) {
    const [{ data: drinks }, { data: goal }] = await Promise.all([
      admin.from("fluid_intake").select("volume_ml, occurred_at, drink").eq("owner_id", profile.id).gte("occurred_at", startOfLocalDayIso(today)),
      prefs.water_target_ml ? Promise.resolve({ data: null }) : admin.from("nutrition_goals").select("water_ml").eq("owner_id", profile.id).maybeSingle(),
    ]);
    const todays = ((drinks ?? []) as { volume_ml: number; occurred_at: string; drink: string }[]).filter((d) => localDate(d.occurred_at, tz) === today && d.drink !== "alcohol");
    const drunkMl = todays.reduce((a, d) => a + d.volume_ml, 0);
    const last = todays.reduce((a, d) => Math.max(a, new Date(d.occurred_at).getTime()), 0);
    const target = prefs.water_target_ml ?? (goal as { water_ml: number | null } | null)?.water_ml ?? 2000;
    const due = dueWaterSlot({
      now: time,
      start: prefs.water_start,
      end: prefs.water_end,
      interval: prefs.water_interval_min,
      target,
      drunkMl,
      minutesSinceLastDrink: last ? (now.getTime() - last) / 60000 : null,
    });
    if (due) {
      const behind = due.expected - drunkMl;
      if ((await notifyUser(admin, profile.id, {
        kind: "water",
        refKey: `water:${today}:${due.slot}`,
        title: `💧 ${tr("Time for a glass of water")}`,
        body: tr("{drunk} / {target} ml so far — about {more} ml to catch up.", { drunk: drunkMl, target, more: Math.max(150, Math.round(behind / 50) * 50) }),
        url: "/food?water=1",
        actions: [{ action: "water-250", title: tr("+250 ml") }],
      })) === "sent") result.sent += 1;
    }
  }

  // Evening "close your day": one nudge, only if goals are left.
  if (prefs.close_day && inWindow(time, toMinutes(prefs.close_day_time.slice(0, 5)))) {
    const water = await waterSettings(admin, profile.id);
    const day = await loadDays(admin, profile.id, {
      tz,
      today,
      days: 1,
      enabled: { medicines: on("medicines"), food: on("food_diary"), checkin: on("checkin") },
      waterTarget: water.target,
    });
    const left = day.today.rings.filter((r) => r.pct < 1).length;
    if (day.today.rings.length && left > 0) {
      await send("close_day", `close:${today}`, `🌙 ${left === 1 ? tr("1 thing left today") : tr("{n} things left today", { n: left })}`, tr("30 seconds to close your day."), "/close");
    }
  }

  // Daily digest of due things, at the person's chosen hour.
  const dailyNow = inWindow(time, prefs.daily_hour * 60, WINDOW_MINUTES);
  if (dailyNow) {
    if (prefs.expiries && on("pantry")) {
      const { data } = await admin.from("pantry_items").select("name, expires_on").eq("household_id", hid).is("used_up_at", null).lte("expires_on", addDays(today, 1)).gte("expires_on", today);
      if (data?.length) {
        await send("pantry", `pantry:${hid}:${today}`, `⏳ ${tr("{n} item(s) expiring", { n: data.length })}`, data.map((p: { name: string }) => p.name).slice(0, 6).join(", "), "/pantry");
      }
    }
    if (prefs.renewals && on("documents")) {
      const { data } = await admin.from("documents").select("id, title, expires_on, remind_days_before, owner_id, scope").eq("household_id", hid).not("expires_on", "is", null);
      for (const d of (data ?? []) as { id: string; title: string; expires_on: string; remind_days_before: number; owner_id: string; scope: string }[]) {
        if (d.scope !== "household" && d.owner_id !== profile.id) continue;
        const left = daysUntil(d.expires_on, today)!;
        if (shouldRemind(left, d.remind_days_before)) {
          await send("document", `doc:${d.id}:${d.expires_on}:${left}`, left < 0 ? `🛂 ${tr("{title} has expired", { title: d.title })}` : `🛂 ${tr("{title} expires in {n} day(s)", { title: d.title, n: left })}`, tr("Expiry {date}. Start the renewal.", { date: d.expires_on }), "/documents");
        }
      }
    }
    if (prefs.renewals && on("subscriptions")) {
      const { data } = await admin.from("subscriptions").select("id, name, next_renewal_on, cost, currency").eq("household_id", hid).eq("active", true).not("next_renewal_on", "is", null);
      for (const s of (data ?? []) as { id: string; name: string; next_renewal_on: string; cost: number | null; currency: string }[]) {
        const left = daysUntil(s.next_renewal_on, today)!;
        if (left === 3 || left === 0) {
          await send("subscription", `sub:${s.id}:${s.next_renewal_on}:${left}`, `🔁 ${left === 0 ? tr("{name} renews today", { name: s.name }) : tr("{name} renews in 3 days", { name: s.name })}`, s.cost != null ? `${s.currency} ${s.cost}` : tr("Cancel it if you don't need it."), "/subscriptions");
        }
      }
    }
    if (prefs.maintenance && on("maintenance")) {
      const { data } = await admin.from("maintenance_tasks").select("id, title, next_due_on, remind_days_before").eq("household_id", hid).not("next_due_on", "is", null);
      for (const t of (data ?? []) as { id: string; title: string; next_due_on: string; remind_days_before: number }[]) {
        const left = daysUntil(t.next_due_on, today)!;
        if (left === t.remind_days_before || left === 0 || left === -1) {
          await send("maintenance", `maint:${t.id}:${t.next_due_on}:${left}`, `🛠️ ${left < 0 ? tr("{title} is overdue", { title: t.title }) : left === 0 ? tr("{title} is due today", { title: t.title }) : tr("{title} is due in {n} days", { title: t.title, n: left })}`, tr("Mark it done in Hearth when it's finished."), "/maintenance");
        }
      }
    }
    if (prefs.child && on("child")) {
      const { data } = await admin.from("vaccinations").select("id, vaccine, due_on, dependent_id").eq("household_id", hid).is("given_on", null).not("due_on", "is", null);
      for (const v of (data ?? []) as { id: string; vaccine: string; due_on: string }[]) {
        const left = daysUntil(v.due_on, today)!;
        if (left === 7 || left === 1 || left === 0) {
          await send("vaccination", `vac:${v.id}:${left}`, `💉 ${left === 0 ? tr("{name} due today", { name: v.vaccine }) : left === 1 ? tr("{name} due tomorrow", { name: v.vaccine }) : tr("{name} due in a week", { name: v.vaccine })}`, tr("Book the paediatrician visit."), "/child/health");
        }
      }
    }
  }

  if (dailyNow && prefs.occasions && on("occasions")) {
    const { data } = await admin.from("occasions").select("*").eq("household_id", hid);
    for (const o of (data ?? []) as Occasion[]) {
      const next = nextOccurrence(o, today);
      if (!next) continue;
      const left = daysUntil(next, today)!;
      if (left === o.remind_days_before || left === 1 || left === 0) {
        await send("occasion", `occ:${o.id}:${next}:${left}`, left === 0 ? `🎉 ${tr("{title} is today", { title: o.title })}` : `🎁 ${tr("{title} in {n} day(s)", { title: o.title, n: left })}`, left === 0 ? tr("Don't forget to celebrate!") : tr("Check your gift ideas in Hearth."), "/occasions");
      }
    }
  }
  if (dailyNow && prefs.travel && on("travel")) {
    const { data } = await admin.from("trips").select("id, title, start_date").eq("household_id", hid).neq("status", "done").not("start_date", "is", null);
    for (const t of (data ?? []) as { id: string; title: string; start_date: string }[]) {
      const left = daysUntil(t.start_date, today)!;
      if (left === 7 || left === 2) {
        const { count } = await admin.from("trip_packing").select("id", { count: "exact", head: true }).eq("trip_id", t.id).eq("packed", false);
        await send("travel", `trip:${t.id}:${left}`, `✈️ ${tr("{title} in {n} day(s)", { title: t.title, n: left })}`, count ? tr("{n} item(s) still to pack.", { n: count }) : tr("Time to start packing."), `/travel/${t.id}`);
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
          await send("digest", `digest:${ws}`, `📬 ${tr("Your weekly summary is ready")}`, tr("Wins, things to watch and what's coming up."), "/digest/wrap");
        } catch (err) {
          console.warn("digest failed", profile.id, (err as Error).message);
        }
      }
    }
  }
  return result;
}
