import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, localDate, startOfLocalDayIso } from "@/lib/dates";
import { streakWithRest } from "@/lib/streak";
import { newMilestones, type MilestoneStats } from "@/modules/engagement/rings";
import type { DayData } from "@/lib/today";

/** Streak (with one forgiven rest day a week) and whether they logged today. Works for a household member too: only dates are revealed. */
export async function activityFor(session: AppSession, userId: string, today: string) {
  const { data } = await session.supabase.rpc("activity_days", { target: userId, since: addDays(today, -400) });
  const dates = new Set(((data ?? []) as string[]).map((d) => String(d).slice(0, 10)));
  return { streak: streakWithRest(dates, today), loggedToday: dates.has(today), dates };
}

/** Checks milestones for the signed-in person; records and returns any reached for the first time. */
export async function checkMilestones(session: AppSession, day: DayData, streak: number, today: string) {
  const me = session.userId;
  const tz = session.profile.timezone;
  const bladderOn = session.isModuleEnabled("bladder_diary");
  const [{ data: done }, { count: doses }, { count: meals }, bl] = await Promise.all([
    session.supabase.from("milestones").select("key").eq("user_id", me),
    session.supabase.from("medicine_doses").select("id", { count: "exact", head: true }).eq("owner_id", me).eq("status", "taken"),
    session.supabase.from("food_entries").select("id", { count: "exact", head: true }).eq("owner_id", me),
    bladderOn ? session.supabase.from("bladder_events").select("kind, occurred_at").eq("owner_id", me).gte("occurred_at", startOfLocalDayIso(addDays(today, -6))) : Promise.resolve({ data: null }),
  ]);
  const events = (bl.data ?? null) as { kind: string; occurred_at: string }[] | null;
  const last7 = day.statuses.slice(-7);
  const stats: MilestoneStats = {
    streak,
    closedDays: day.statuses.filter((s) => s.closed).length,
    dosesTaken: doses ?? 0,
    mealsLogged: meals ?? 0,
    waterTargetDays7: last7.filter((s) => s.rings.find((r) => r.key === "water")?.pct === 1).length,
    bladderLoggedDays7: events ? new Set(events.map((e) => localDate(e.occurred_at, tz))).size : null,
    leaks7: events ? events.filter((e) => e.kind === "leak").length : null,
  };
  const fresh = newMilestones(stats, new Set(((done ?? []) as { key: string }[]).map((d) => d.key)));
  if (fresh.length) await session.supabase.from("milestones").upsert(fresh.map((m) => ({ user_id: me, key: m.key })), { onConflict: "user_id,key", ignoreDuplicates: true });
  return fresh;
}

/** Recent cheers sent to me (last 2 days). */
export async function recentCheers(session: AppSession) {
  const since = new Date(Date.now() - 2 * 86400_000).toISOString();
  const { data } = await session.supabase.from("cheers").select("from_user, emoji, created_at").eq("to_user", session.userId).gte("created_at", since).order("created_at", { ascending: false }).limit(5);
  return ((data ?? []) as { from_user: string; emoji: string; created_at: string }[]).map((c) => ({
    ...c,
    name: session.members.find((m) => m.user_id === c.from_user)?.display_name ?? "",
  }));
}
