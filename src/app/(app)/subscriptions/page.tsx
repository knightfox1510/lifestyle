import { getSession } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { Subscription } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { daysUntil } from "@/modules/pantry/match";
import { monthlyCost } from "@/modules/subscriptions/logic";
import { SubForm } from "./sub-form";
import { deleteSubscription, markRenewed, setSubscriptionActive } from "./actions";

export const metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage() {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const { data } = await session.supabase.from("subscriptions").select("*").eq("household_id", session.household.id).order("active", { ascending: false }).order("next_renewal_on", { ascending: true, nullsFirst: false });
  const subs = (data ?? []) as Subscription[];
  const active = subs.filter((s) => s.active);
  const names = Object.fromEntries(session.members.map((m) => [m.user_id, m.display_name]));
  const byCurrency = new Map<string, number>();
  for (const s of active) byCurrency.set(s.currency, (byCurrency.get(s.currency) ?? 0) + monthlyCost(s));

  return (
    <div className="space-y-4">
      {active.length ? (
        <div className="grid grid-cols-2 gap-3">
          <Card className="!p-3.5">
            <p className="text-xs text-fg-muted">Active</p>
            <p className="text-2xl font-semibold">{active.length}</p>
          </Card>
          <Card className="!p-3.5">
            <p className="text-xs text-fg-muted">Per month (approx.)</p>
            <p className="text-2xl font-semibold tabular-nums">
              {[...byCurrency.entries()].map(([cur, v]) => `${cur === "INR" ? "₹" : `${cur} `}${Math.round(v).toLocaleString("en-IN")}`).join(" + ") || "–"}
            </p>
          </Card>
        </div>
      ) : null}
      <SubForm members={session.members.map((m) => ({ id: m.user_id, name: m.display_name }))} />
      {subs.length === 0 ? (
        <EmptyState title="No subscriptions yet">Add Netflix, Prime, Zomato Gold, cloud storage… so both of you know what&apos;s available.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {subs.map((s) => {
            const d = daysUntil(s.next_renewal_on, today);
            return (
              <li key={s.id}>
                <Card className={`!p-4 ${s.active ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.name}</a> : s.name}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {s.category}
                        {s.cost != null ? ` · ${s.currency === "INR" ? "₹" : `${s.currency} `}${Number(s.cost).toLocaleString("en-IN")} ${s.billing_cycle.replace("_", "-")}` : ""}
                        {s.paid_by ? ` · paid by ${names[s.paid_by] ?? "–"}` : ""}
                        {s.next_renewal_on ? ` · renews ${formatDate(s.next_renewal_on)}` : ""}
                        {!s.auto_renew ? " · manual renewal" : ""}
                      </p>
                      {s.notes ? <p className="text-xs text-fg-muted">{s.notes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {s.active && d !== null && d <= 7 ? <Badge tone={d < 0 ? "danger" : "warn"}>{d < 0 ? "renewal passed" : d === 0 ? "renews today" : `renews in ${d}d`}</Badge> : null}
                      {s.next_renewal_on && s.active ? (
                        <form action={markRenewed.bind(null, s.id)}>
                          <button className={buttonClass("ghost", "sm")}>Renewed</button>
                        </form>
                      ) : null}
                      <form action={setSubscriptionActive.bind(null, s.id, !s.active)}>
                        <button className={buttonClass("ghost", "sm")}>{s.active ? "Cancelled" : "Reactivate"}</button>
                      </form>
                      <form action={deleteSubscription.bind(null, s.id)}>
                        <button className="px-1 text-xs text-fg-muted hover:text-danger" aria-label={`Delete ${s.name}`}>✕</button>
                      </form>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
