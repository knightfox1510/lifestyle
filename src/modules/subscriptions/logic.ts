import type { Subscription } from "@/lib/types";

const MONTHS: Record<Subscription["billing_cycle"], number> = { weekly: 0, monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };

export function nextRenewal(date: string, cycle: Subscription["billing_cycle"]) {
  const d = new Date(`${date}T12:00:00Z`);
  if (cycle === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + MONTHS[cycle]);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}

/** Cost normalised to a month. */
export function monthlyCost(s: Pick<Subscription, "cost" | "billing_cycle">) {
  if (s.cost == null) return 0;
  const c = Number(s.cost);
  return s.billing_cycle === "weekly" ? (c * 52) / 12 : c / MONTHS[s.billing_cycle];
}
