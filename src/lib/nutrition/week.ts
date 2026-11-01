import "server-only";

import type { AppSession } from "@/lib/session";
import { addDays, dayOfWeek, localDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import type { FoodEntry, LabResult, NutritionGoals } from "@/lib/types";
import { MICRO_KEYS, dailyTargets, fromEntry, sum, type NutrientKey, type Nutrients } from "@/modules/nutrition/nutrients";
import { labNutrientLinks } from "@/modules/nutrition/labs-link";
import { normalizeName } from "@/modules/pantry/match";

export type WeekReport = Awaited<ReturnType<typeof weekNutrition>>;

/** Nutrition for one person for the Mon–Sun week containing `anyDay`. */
export async function weekNutrition(session: AppSession, ownerId: string, anyDay?: string) {
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const base = anyDay && /^\d{4}-\d{2}-\d{2}$/.test(anyDay) ? anyDay : today;
  const monday = addDays(base, -((dayOfWeek(base) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const medicalOn = session.isModuleEnabled("medical_records") && session.accessTo("medical_records", ownerId) !== "none";

  const [{ data: e }, { data: g }, mp, labs] = await Promise.all([
    session.supabase.from("food_entries").select("*").eq("owner_id", ownerId).gte("eaten_at", startOfLocalDayIso(monday)).lt("eaten_at", startOfLocalDayIso(addDays(monday, 9))),
    session.supabase.from("nutrition_goals").select("*").eq("owner_id", ownerId).maybeSingle(),
    medicalOn ? session.supabase.from("medical_profiles").select("sex").eq("owner_id", ownerId).maybeSingle() : Promise.resolve({ data: null }),
    medicalOn ? session.supabase.from("lab_results").select("marker, value, unit, flag, test_date").eq("owner_id", ownerId).neq("flag", "normal").limit(200) : Promise.resolve({ data: [] }),
  ]);
  const entries = ((e ?? []) as FoodEntry[]).filter((x) => days.includes(localDate(x.eaten_at, tz)));
  const goals = g as NutritionGoals | null;
  const byDay = days.map((d) => {
    const list = entries.filter((x) => localDate(x.eaten_at, tz) === d);
    return { date: d, count: list.length, n: sum(list.map((x) => fromEntry({ ...x, micros: x.micros ?? {} }))), irritants: [...new Set(list.flatMap((x) => x.irritants ?? []))] };
  });
  const logged = byDay.filter((d) => d.count > 0);
  const total = sum(logged.map((d) => d.n));
  const avg: Nutrients = Object.fromEntries(Object.entries(total).map(([k, v]) => [k, Math.round(((v as number) / Math.max(1, logged.length)) * 10) / 10]));
  const targets = dailyTargets((mp.data as { sex: "female" | "male" | "other" | null } | null)?.sex ?? null, goals?.calories ?? null);
  const labLinks = labNutrientLinks((labs.data ?? []) as Pick<LabResult, "marker" | "value" | "unit" | "flag" | "test_date">[]);

  // Top contributors by food name.
  const groups = new Map<string, { name: string; n: Nutrients; times: number }>();
  for (const x of entries) {
    const key = normalizeName(x.description) || x.description.toLowerCase();
    const cur = groups.get(key) ?? { name: x.description, n: {}, times: 0 };
    cur.n = sum([cur.n, fromEntry({ ...x, micros: x.micros ?? {} })]);
    cur.times += 1;
    groups.set(key, cur);
  }
  const top = (k: NutrientKey, n = 5) =>
    [...groups.values()].filter((x) => (x.n[k] ?? 0) > 0).sort((a, b) => (b.n[k] ?? 0) - (a.n[k] ?? 0)).slice(0, n);

  const gaps = (MICRO_KEYS as readonly NutrientKey[])
    .concat(["fiber_g"])
    .filter((k) => targets[k])
    .map((k) => ({ k, t: targets[k]!, v: avg[k] }))
    .filter((x) => x.v !== undefined && (x.t.kind === "min" ? x.v! < x.t.amount * 0.6 : x.v! > x.t.amount));

  return {
    monday,
    days,
    byDay,
    logged: logged.length,
    avg,
    total,
    goals,
    targets,
    labLinks,
    coverage: { withData: entries.filter((x) => x.accuracy && x.accuracy !== "estimated").length, total: entries.length },
    top: { calories: top("calories"), protein_g: top("protein_g"), sodium_mg: top("sodium_mg", 3), sugar_g: top("sugar_g", 3) },
    gaps,
    irritantDays: byDay.filter((d) => d.irritants.length >= 2).length,
    restaurantItems: entries.filter((x) => x.source === "restaurant").length,
  };
}
