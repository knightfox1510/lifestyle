import "server-only";

import type { AppSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/push";
import { FEATURES, estimateUsd, profileFor, type UsageRow } from "@/lib/ai/profile";

/** Rough rupees per US dollar, for showing Google's dollar prices in ₹. */
export const USD_INR = 88;

/** Estimated AI spend this calendar month (UTC), in ₹. */
export async function monthSpendInr(session: AppSession) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await session.supabase
    .from("ai_usage")
    .select("input_tokens, output_tokens, thinking_tokens, cached_tokens, search_queries, model, batch")
    .eq("household_id", session.household.id)
    .gte("created_at", start.toISOString())
    .limit(20000);
  if (error) return 0;
  return ((data ?? []) as UsageRow[]).reduce((a, r) => a + estimateUsd(r), 0) * USD_INR;
}

type BudgetHousehold = { ai_monthly_budget_inr?: number | null; ai_search_daily_limit?: number | null; ai_budget_warned_month?: string | null };

/**
 * Stops AI once the household's monthly budget (Settings → Household) is used
 * up, warns the owner once a month at 80%, and caps web-search features per
 * day (they cost extra per search). Returns an error message, or null.
 */
export async function budgetBlock(session: AppSession, feature: string): Promise<string | null> {
  const h = session.household as typeof session.household & BudgetHousehold;
  if (profileFor(feature).search && h.ai_search_daily_limit != null) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    const searchFeatures = Object.entries(FEATURES).filter(([, p]) => p.search).map(([k]) => k);
    const { count } = await session.supabase.from("ai_usage").select("id", { count: "exact", head: true }).eq("household_id", session.household.id).in("feature", searchFeatures).eq("from_cache", false).gte("created_at", day.toISOString());
    if ((count ?? 0) >= h.ai_search_daily_limit) return `Today's web-search lookups are used up (${h.ai_search_daily_limit}). They reset at midnight UTC, or the owner can raise the limit in Settings → Household.`;
  }
  const budget = h.ai_monthly_budget_inr;
  if (!budget) return null;
  const spent = await monthSpendInr(session);
  if (spent >= budget) return `This month's AI budget (₹${budget}) is used up. It resets on the 1st, or the owner can raise it in Settings → Household.`;
  const month = new Date().toISOString().slice(0, 7);
  if (spent >= budget * 0.8 && h.ai_budget_warned_month !== month) {
    const admin = createAdminClient();
    await admin.from("households").update({ ai_budget_warned_month: month }).eq("id", session.household.id);
    for (const m of session.members.filter((x) => x.role === "owner")) {
      await notifyUser(admin, m.user_id, { kind: "ai_budget", refKey: `ai-budget:${month}`, title: "💸 AI budget 80% used", body: `About ₹${Math.round(spent)} of ₹${budget} this month. See which features use the most.`, url: "/settings/ai-usage" }).catch(() => null);
    }
  }
  return null;
}
