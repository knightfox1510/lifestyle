import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays } from "@/lib/dates";
import { loadDays, waterSettings } from "@/lib/today";
import { waterAccess } from "@/lib/water";
import { goalDays, type FitnessGoal } from "@/modules/fitness/goals";
import { nextOccurrence } from "@/modules/occasions/logic";
import { recapHighlights, recapWeek, type PersonWeek } from "@/modules/engagement/recap";
import type { Occasion, WorkoutLog } from "@/lib/types";

/**
 * Everything for "Our week": each person's week (only what they share with
 * the viewer), the joint goal, the watchlist, eating out and what's coming
 * up. The private log is never read here.
 */
export async function loadRecap(session: AppSession, which?: "this" | "last") {
  const tz = session.profile.timezone;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const week = recapWeek(today, which);
  const hid = session.household.id;
  const people = session.members.slice(0, 4);
  const db = session.supabase;

  const perPerson = await Promise.all(
    people.map(async (m) => {
      const id = m.user_id;
      const can = (mod: string) => session.isModuleEnabled(mod) && session.accessTo(mod, id) !== "none" && !session.isHiddenFor(mod, id);
      const water = await waterSettings(db, id);
      const [days, logs, goals, wear, cheers] = await Promise.all([
        loadDays(db, id, {
          tz,
          today: week.end,
          days: week.days,
          enabled: { medicines: can("medicines"), food: can("food_diary"), checkin: can("checkin"), supplements: can("supplements"), water: waterAccess(session, id) !== "none" },
          waterTarget: water.target,
          supplementTimes: null,
        }),
        can("fitness") ? db.from("workout_logs").select("performed_on, kind, status, duration_minutes").eq("owner_id", id).gte("performed_on", week.start).lte("performed_on", week.end) : Promise.resolve({ data: null }),
        can("fitness") ? db.from("fitness_goals").select("kind, times_per_week, min_minutes").eq("owner_id", id).eq("active", true) : Promise.resolve({ data: null }),
        can("wearables") ? db.from("wearable_daily").select("steps").eq("owner_id", id).gte("day", week.start).lte("day", week.end) : Promise.resolve({ data: null }),
        db.from("cheers").select("id", { count: "exact", head: true }).eq("household_id", hid).eq("from_user", id).gte("created_at", `${week.start}T00:00:00Z`).lte("created_at", `${addDays(week.end, 1)}T00:00:00Z`),
      ]);
      const wl = logs.data as Pick<WorkoutLog, "performed_on" | "kind" | "status" | "duration_minutes">[] | null;
      const gl = goals.data as Pick<FitnessGoal, "kind" | "times_per_week" | "min_minutes">[] | null;
      const done = (wl ?? []).filter((l) => l.status === "done");
      const closedSet = new Set(days.statuses.filter((s) => s.closed || s.closedAt).map((s) => s.date));
      const tracksDay = days.statuses.some((s) => s.rings.length);
      const steps = ((wear.data ?? []) as { steps: number | null }[]).reduce((a, w) => a + Number(w.steps ?? 0), 0);
      const pw: PersonWeek = {
        name: id === session.userId ? "You" : m.display_name,
        workouts: wl ? { sessions: done.length, minutes: done.reduce((a, l) => a + (l.duration_minutes ?? 0), 0), goals: gl?.length ?? 0, goalsMet: (gl ?? []).filter((g) => goalDays(g, wl, week.start, week.end).size >= g.times_per_week).length } : null,
        closedDays: tracksDay ? closedSet.size : null,
        steps: wear.data ? steps : null,
        cheersSent: cheers.count ?? 0,
      };
      return { id, pw, closedSet, goals: gl, logs: wl };
    }),
  );

  const [items, orders, occasions] = await Promise.all([
    session.isModuleEnabled("watchlist") ? db.from("watchlist_items").select("id, title, status, together, platform, updated_at, kind").eq("household_id", hid) : Promise.resolve({ data: [] }),
    session.isModuleEnabled("dining") ? db.from("dining_orders").select("id", { count: "exact", head: true }).eq("household_id", hid).gte("ordered_on", week.start).lte("ordered_on", week.end) : Promise.resolve({ count: 0 }),
    session.isModuleEnabled("occasions") ? db.from("occasions").select("*").eq("household_id", hid) : Promise.resolve({ data: [] }),
  ]);
  type Item = { id: string; title: string; status: string; together: boolean; platform: string | null; updated_at: string; kind: string };
  const list = (items.data ?? []) as Item[];
  const inWeek = (iso: string) => iso.slice(0, 10) >= week.start && iso.slice(0, 10) <= week.end;
  const watched = {
    finished: list.filter((i) => i.status === "finished" && inWeek(i.updated_at)).map((i) => i.title),
    together: list.filter((i) => i.status === "watching" && i.together).map((i) => ({ title: i.title, where: i.platform ?? "" })),
  };

  // Joint goal: days both closed (only when both people's days are visible).
  const pair = perPerson.length >= 2 && perPerson[0].pw.closedDays != null && perPerson[1].pw.closedDays != null ? perPerson.slice(0, 2) : null;
  const bothClosed = pair ? [...pair[0].closedSet].filter((d) => pair[1].closedSet.has(d)).length : null;

  const upcoming = ((occasions.data ?? []) as Occasion[])
    .map((o) => ({ title: o.title, on: nextOccurrence(o, today) }))
    .filter((o): o is { title: string; on: string } => Boolean(o.on && o.on <= addDays(today, 14)))
    .sort((a, b) => a.on.localeCompare(b.on))
    .slice(0, 4);

  const input = { people: perPerson.map((p) => p.pw), bothClosed, jointGoal: 5, watched, eatingOut: (orders as { count: number | null }).count ?? 0, last: week.last };
  return { week, today, people: perPerson.map((p) => ({ ...p.pw, id: p.id, goals: p.goals, logs: p.logs })), bothClosed, watched, eatingOut: input.eatingOut, upcoming, highlights: recapHighlights(input) };
}
