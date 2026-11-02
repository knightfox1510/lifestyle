import "server-only";

import type { AppSession } from "@/lib/session";
import type { Nutrients } from "@/modules/nutrition/nutrients";
import { supplementTotals } from "@/modules/nutrition/supplements";
import { medicineDoseNutrients } from "@/modules/medicines/nutrients";

/**
 * Nutrients from supplements ticked as taken and medicine doses marked taken
 * (e.g. calcium + D3, iron, B12 tablets), per day (YYYY-MM-DD), for one
 * person. Respects each module's share; returns {} when there's nothing.
 */
export async function supplementNutrientsByDay(session: AppSession, ownerId: string, from: string, to: string): Promise<Record<string, Nutrients>> {
  const can = (m: string) => session.isModuleEnabled(m) && session.accessTo(m, ownerId) !== "none";
  const none = Promise.resolve({ data: [] as unknown[] });
  const [{ data: sups }, { data: logs }, { data: meds }, { data: doses }] = await Promise.all([
    can("supplements") ? session.supabase.from("supplements").select("id, nutrients").eq("owner_id", ownerId) : none,
    can("supplements") ? session.supabase.from("supplement_logs").select("supplement_id, log_date").eq("owner_id", ownerId).gte("log_date", from).lte("log_date", to) : none,
    // On a database without the nutrients column yet this errors → no rows, nothing added.
    can("medicines") ? session.supabase.from("medicines").select("id, dose_amount, nutrients").eq("owner_id", ownerId) : none,
    can("medicines") ? session.supabase.from("medicine_doses").select("medicine_id, scheduled_date, status").eq("owner_id", ownerId).eq("status", "taken").gte("scheduled_date", from).lte("scheduled_date", to) : none,
  ]);
  const byId = new Map(((sups ?? []) as { id: string; nutrients: Record<string, unknown> | null }[]).map((s) => [s.id, s.nutrients ?? {}]));
  const days: Record<string, { nutrients: Record<string, unknown> | null }[]> = {};
  for (const l of (logs ?? []) as { supplement_id: string; log_date: string }[]) {
    const n = byId.get(l.supplement_id);
    if (n && Object.keys(n).length) (days[l.log_date] ??= []).push({ nutrients: n });
  }
  for (const [date, n] of Object.entries(
    medicineDoseNutrients(
      (meds ?? []) as { id: string; dose_amount: number; nutrients: Record<string, number> | null }[],
      (doses ?? []) as { medicine_id: string; scheduled_date: string; status: string }[],
    ),
  )) {
    (days[date] ??= []).push({ nutrients: n });
  }
  return Object.fromEntries(Object.entries(days).map(([d, list]) => [d, supplementTotals(list)]));
}
