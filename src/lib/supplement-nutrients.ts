import "server-only";

import type { AppSession } from "@/lib/session";
import type { Nutrients } from "@/modules/nutrition/nutrients";
import { supplementTotals } from "@/modules/nutrition/supplements";

/**
 * Nutrients from supplements ticked as taken, per day (YYYY-MM-DD), for one
 * person. Respects the supplements share; returns {} when there's nothing.
 */
export async function supplementNutrientsByDay(session: AppSession, ownerId: string, from: string, to: string): Promise<Record<string, Nutrients>> {
  if (!session.isModuleEnabled("supplements") || session.accessTo("supplements", ownerId) === "none") return {};
  const [{ data: sups }, { data: logs }] = await Promise.all([
    session.supabase.from("supplements").select("id, nutrients").eq("owner_id", ownerId),
    session.supabase.from("supplement_logs").select("supplement_id, log_date").eq("owner_id", ownerId).gte("log_date", from).lte("log_date", to),
  ]);
  const byId = new Map(((sups ?? []) as { id: string; nutrients: Record<string, unknown> | null }[]).map((s) => [s.id, s.nutrients ?? {}]));
  const days: Record<string, { nutrients: Record<string, unknown> | null }[]> = {};
  for (const l of (logs ?? []) as { supplement_id: string; log_date: string }[]) {
    const n = byId.get(l.supplement_id);
    if (n && Object.keys(n).length) (days[l.log_date] ??= []).push({ nutrients: n });
  }
  return Object.fromEntries(Object.entries(days).map(([d, list]) => [d, supplementTotals(list)]));
}
