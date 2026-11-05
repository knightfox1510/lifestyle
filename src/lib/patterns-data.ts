import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, localDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import type { DayFacts } from "@/modules/patterns";
import { drinksOf } from "@/modules/private-log/meta";

/** 90 days of one person's daily facts for pattern finding, from whatever they track and share. */
/**
 * `withPrivate` adds the private log (drinks, intimacy) and overnight weight
 * changes: only ever for your own data, for the private log page.
 */
export async function loadPatternDays(session: AppSession, ownerId: string, days = 90, withPrivate = false): Promise<DayFacts[]> {
  const can = (m: string) => session.isModuleEnabled(m) && session.accessTo(m, ownerId) !== "none";
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const from = addDays(today, -(days - 1));
  const fromIso = startOfLocalDayIso(from);
  const db = session.supabase;
  const none = Promise.resolve({ data: [] as unknown[] });
  const priv = withPrivate && ownerId === session.userId && session.isModuleEnabled("private_log");
  const [wear, checks, food, bladder, fluids, workouts, privLogs, weights] = await Promise.all([
    can("wearables") ? db.from("wearable_daily").select("day, steps, sleep_minutes").eq("owner_id", ownerId).gte("day", from) : none,
    can("checkin") ? db.from("daily_checkins").select("checkin_date, sleep_hours, mood, energy, stress").eq("owner_id", ownerId).gte("checkin_date", from) : none,
    can("food_diary") ? db.from("food_entries").select("eaten_at, calories, protein_g").eq("owner_id", ownerId).gte("eaten_at", fromIso).limit(8000) : none,
    can("bladder_diary") ? db.from("bladder_events").select("occurred_at, kind").eq("owner_id", ownerId).gte("occurred_at", fromIso).limit(8000) : none,
    can("bladder_diary") ? db.from("fluid_intake").select("occurred_at, volume_ml, caffeinated, drink").eq("owner_id", ownerId).gte("occurred_at", fromIso).limit(8000) : none,
    can("fitness") ? db.from("workout_logs").select("performed_on, status").eq("owner_id", ownerId).gte("performed_on", from) : none,
    priv ? db.from("private_logs").select("kind, detail, amount, occurred_on").eq("owner_id", ownerId).in("kind", ["alcohol", "intimacy"]).gte("occurred_on", from) : none,
    priv && can("body_recomp") ? db.from("body_metrics").select("measured_at, weight_kg").eq("owner_id", ownerId).not("weight_kg", "is", null).gte("measured_at", fromIso).order("measured_at") : none,
  ]);
  const map = new Map<string, DayFacts>();
  const get = (d: string) => map.get(d) ?? (map.set(d, { day: d }), map.get(d)!);
  for (let i = 0; i < days; i++) get(addDays(from, i));

  for (const w of (wear.data ?? []) as { day: string; steps: number | null; sleep_minutes: number | null }[]) {
    if (!map.has(w.day)) continue;
    const d = get(w.day);
    if (w.steps) d.steps = w.steps;
    if (w.sleep_minutes && w.sleep_minutes >= 120) d.sleepH = Math.round((w.sleep_minutes / 60) * 10) / 10;
  }
  for (const c of (checks.data ?? []) as { checkin_date: string; sleep_hours: number | null; mood: number | null; energy: number | null; stress: number | null }[]) {
    if (!map.has(c.checkin_date)) continue;
    const d = get(c.checkin_date);
    if (d.sleepH == null && c.sleep_hours) d.sleepH = Number(c.sleep_hours);
    d.mood = c.mood;
    d.energy = c.energy;
    d.stress = c.stress;
  }
  const kcal = new Map<string, { k: number; p: number }>();
  for (const f of (food.data ?? []) as { eaten_at: string; calories: number | null; protein_g: number | null }[]) {
    const day = localDate(f.eaten_at, tz);
    const x = kcal.get(day) ?? { k: 0, p: 0 };
    x.k += Number(f.calories ?? 0);
    x.p += Number(f.protein_g ?? 0);
    kcal.set(day, x);
  }
  // Only days that look fully logged count (a forgotten dinner isn't "eating less").
  for (const [day, x] of kcal) if (map.has(day) && x.k >= 800 && day < today) Object.assign(get(day), { kcal: Math.round(x.k), protein: Math.round(x.p) });
  const bladderDays = new Map<string, number>();
  for (const e of (bladder.data ?? []) as { occurred_at: string; kind: string }[]) {
    const day = localDate(e.occurred_at, tz);
    bladderDays.set(day, (bladderDays.get(day) ?? 0) + (e.kind === "leak" ? 1 : 0));
  }
  for (const [day, n] of bladderDays) if (map.has(day)) get(day).leaks = n;
  const fl = new Map<string, { all: number; caf: number }>();
  for (const f of (fluids.data ?? []) as { occurred_at: string; volume_ml: number; caffeinated: boolean; drink: string }[]) {
    const day = localDate(f.occurred_at, tz);
    const x = fl.get(day) ?? { all: 0, caf: 0 };
    if (f.drink !== "alcohol") x.all += f.volume_ml;
    if (f.caffeinated) x.caf += f.volume_ml;
    fl.set(day, x);
  }
  for (const [day, x] of fl) if (map.has(day) && bladderDays.has(day)) Object.assign(get(day), { fluidMl: x.all, caffeineMl: x.caf });
  if (can("fitness")) {
    const done = new Set(((workouts.data ?? []) as { performed_on: string; status: string }[]).filter((w) => w.status === "done").map((w) => w.performed_on));
    for (const d of map.values()) if (d.day < today) d.workout = done.has(d.day);
  }
  if (priv) {
    const rows = (privLogs.data ?? []) as { kind: "alcohol" | "intimacy"; detail: string | null; amount: number | null; occurred_on: string }[];
    // Days before the log was started aren't "alcohol-free": they're unknown.
    const started = rows.reduce<string | null>((a, r) => (!a || r.occurred_on < a ? r.occurred_on : a), null);
    if (started) {
      for (const d of map.values()) {
        if (d.day < started || d.day > today) continue;
        const own = rows.filter((r) => r.occurred_on === d.day);
        d.drinks = own.reduce((a, r) => a + drinksOf(r), 0);
        d.intimacy = own.some((r) => r.kind === "intimacy");
      }
    }
    // First weigh-in of each day; the change to the next morning's.
    const firstWeigh = new Map<string, number>();
    for (const w of (weights.data ?? []) as { measured_at: string; weight_kg: number }[]) {
      const day = localDate(w.measured_at, tz);
      if (!firstWeigh.has(day)) firstWeigh.set(day, Number(w.weight_kg));
    }
    for (const [day, kg] of firstWeigh) {
      const next = firstWeigh.get(addDays(day, 1));
      if (next != null && map.has(day)) get(day).weightChange = Math.round((next - kg) * 10) / 10;
    }
  }
  return [...map.values()];
}
