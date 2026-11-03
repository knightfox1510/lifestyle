import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { lastNDays, localDate, localTime, startOfLocalDayIso } from "@/lib/dates";
import type { Medicine, MedicineDose, NotificationPrefs, Supplement, SupplementLog } from "@/lib/types";
import { supplementRepeat, timingTimes } from "@/modules/supplements/meta";
import { isDueOn } from "@/modules/schedule";
import { slotsForDay } from "@/modules/medicines/logic";
import { MAIN_MEALS, dayClosed, rings, type Ring, type RingInput } from "@/modules/engagement/rings";

export type ArcEvent = { time: string; kind: "water" | "food" | "meds" | "check" };
export type DayStatus = { date: string; rings: Ring[]; closed: boolean; any: boolean };

/** `water: false` when the person viewing can't see this person's water (not shared). */
type Enabled = { medicines: boolean; food: boolean; checkin: boolean; supplements?: boolean; water?: boolean };

/**
 * Everything the day view needs for one person over the last `days` days:
 * per-day goals (closed or not), today's events for the day arc, and the
 * raw bits for "next up". Works with the user's client (RLS) or the admin
 * client (reminder job).
 */
export async function loadDays(
  db: SupabaseClient,
  ownerId: string,
  opts: { tz: string; today: string; days: number; enabled: Enabled; waterTarget: number; supplementTimes?: Record<string, string> | null },
) {
  const { tz, today, enabled } = opts;
  const dayList = lastNDays(today, opts.days);
  const from = startOfLocalDayIso(dayList[0]);
  const none = Promise.resolve({ data: [] as unknown[] });
  const [fl, fd, md, ds, ci, sp, sl] = await Promise.all([
    enabled.water === false ? none : db.from("fluid_intake").select("volume_ml, occurred_at, drink").eq("owner_id", ownerId).gte("occurred_at", from).limit(3000),
    enabled.food ? db.from("food_entries").select("eaten_at, meal").eq("owner_id", ownerId).gte("eaten_at", from).limit(3000) : none,
    enabled.medicines ? db.from("medicines").select("*").eq("owner_id", ownerId).eq("active", true) : none,
    enabled.medicines ? db.from("medicine_doses").select("*").eq("owner_id", ownerId).gte("scheduled_date", dayList[0]) : none,
    enabled.checkin ? db.from("daily_checkins").select("checkin_date, updated_at").eq("owner_id", ownerId).gte("checkin_date", dayList[0]) : none,
    enabled.supplements ? db.from("supplements").select("*").eq("owner_id", ownerId).eq("active", true) : none,
    enabled.supplements ? db.from("supplement_logs").select("supplement_id, log_date, taken_at").eq("owner_id", ownerId).gte("log_date", dayList[0]) : none,
  ]);
  const supps = (sp.data ?? []) as (Supplement & { created_at: string })[];
  const times = timingTimes(opts.supplementTimes);
  const suppLogs = (sl.data ?? []) as Pick<SupplementLog, "supplement_id" | "log_date" | "taken_at">[];
  // A supplement counts on the days it's due (every day, chosen weekdays or every N days), from when it started.
  const suppsOn = (date: string) => supps.filter((x) => isDueOn(supplementRepeat(x, (iso) => localDate(iso, tz)), date));
  const fluids = (fl.data ?? []) as { volume_ml: number; occurred_at: string; drink: string }[];
  const foods = (fd.data ?? []) as { eaten_at: string; meal: string }[];
  const meds = (md.data ?? []) as Medicine[];
  const doses = (ds.data ?? []) as MedicineDose[];
  const checkins = (ci.data ?? []) as { checkin_date: string; updated_at: string }[];

  const statuses: DayStatus[] = dayList.map((date) => {
    const water = fluids.filter((f) => f.drink !== "alcohol" && localDate(f.occurred_at, tz) === date).reduce((a, f) => a + f.volume_ml, 0);
    const meals = new Set(foods.filter((f) => localDate(f.eaten_at, tz) === date && (MAIN_MEALS as readonly string[]).includes(f.meal)).map((f) => f.meal));
    const slots = enabled.medicines ? slotsForDay(meds.filter((m) => m.start_date <= date), doses, date) : [];
    const checked = checkins.some((c) => c.checkin_date === date);
    const inputs: RingInput[] = [
      ...(enabled.water === false ? [] : [{ key: "water" as const, value: water, target: opts.waterTarget }]),
      ...(enabled.food ? [{ key: "food" as const, value: meals.size, target: 3 }] : []),
      // Medicines and supplements share one ring: every scheduled dose and every daily supplement counts.
      ...(enabled.medicines || enabled.supplements
        ? [
            {
              key: "meds" as const,
              value: slots.filter((s) => s.dose?.status === "taken").length + suppsOn(date).filter((x) => suppLogs.some((l) => l.supplement_id === x.id && l.log_date === date)).length,
              target: slots.length + suppsOn(date).length,
            },
          ]
        : []),
      ...(enabled.checkin ? [{ key: "check" as const, value: checked ? 1 : 0, target: 1 }] : []),
    ];
    const rs = rings(inputs);
    return { date, rings: rs, closed: dayClosed(rs), any: water > 0 || meals.size > 0 || checked || slots.some((s) => s.dose) || suppLogs.some((l) => l.log_date === date) };
  });

  const todayFluids = fluids.filter((f) => localDate(f.occurred_at, tz) === today);
  const events: ArcEvent[] = [
    ...todayFluids.map((f) => ({ time: localTime(f.occurred_at, tz), kind: "water" as const })),
    ...foods.filter((f) => localDate(f.eaten_at, tz) === today).map((f) => ({ time: localTime(f.eaten_at, tz), kind: "food" as const })),
    ...doses.filter((d) => d.scheduled_date === today && d.status === "taken").map((d) => ({ time: localTime(d.taken_at, tz), kind: "meds" as const })),
    ...suppLogs.filter((l) => l.log_date === today).map((l) => ({ time: localTime(l.taken_at, tz), kind: "meds" as const })),
    ...checkins.filter((c) => c.checkin_date === today).map((c) => ({ time: localTime(c.updated_at, tz), kind: "check" as const })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const todaySlots = enabled.medicines ? slotsForDay(meds, doses, today) : [];
  return {
    statuses,
    today: statuses.at(-1)!,
    events,
    waterMl: todayFluids.filter((f) => f.drink !== "alcohol").reduce((a, f) => a + f.volume_ml, 0),
    mealsToday: [...new Set(foods.filter((f) => localDate(f.eaten_at, tz) === today).map((f) => f.meal))],
    checkinToday: checkins.some((c) => c.checkin_date === today),
    dueDoses: todaySlots.filter((s) => !s.dose).map((s) => ({ medicineId: s.medicine.id, name: s.medicine.name, strength: s.medicine.strength, time: s.time })),
    /** Supplements not ticked yet today, with the clock time of their timing (null = any time). */
    dueSupplements: suppsOn(today)
      .filter((x) => !suppLogs.some((l) => l.supplement_id === x.id && l.log_date === today))
      .map((x) => ({ supplementId: x.id, name: x.name, dose: x.dose, timing: x.timing, time: times[x.timing] })),
    week: lastNDays(today, 7).map((d) => statuses.find((s) => s.date === d) ?? { date: d, rings: [], closed: false, any: false }),
  };
}

export type DayData = Awaited<ReturnType<typeof loadDays>>;

/** Water target and reminder window for a person (prefs → nutrition goal → 2000 ml). */
export async function waterSettings(db: SupabaseClient, ownerId: string) {
  const [{ data: prefs }, { data: goal }] = await Promise.all([
    db.from("notification_prefs").select("water_target_ml, water_start, water_end").eq("user_id", ownerId).maybeSingle(),
    db.from("nutrition_goals").select("water_ml").eq("owner_id", ownerId).maybeSingle(),
  ]);
  const p = prefs as Pick<NotificationPrefs, "water_target_ml" | "water_start" | "water_end"> | null;
  return {
    target: p?.water_target_ml ?? (goal as { water_ml: number | null } | null)?.water_ml ?? 2000,
    start: (p?.water_start ?? "08:00").slice(0, 5),
    end: (p?.water_end ?? "19:30").slice(0, 5),
  };
}

