import Link from "next/link";
import { getSession } from "@/lib/session";
import { shortDate, todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, buttonClass, cx } from "@/components/ui";
import type { PantryItem, PantryLocation } from "@/lib/types";
import { CATEGORY_META } from "@/modules/groceries/meta";
import { daysUntil } from "@/modules/pantry/match";
import { AddPantryForm } from "./add-form";
import { deletePantryItem, markUsedUp, setExpiry, setOpened } from "./actions";

export const metadata = { title: "Pantry" };

const LOCATIONS: { key: PantryLocation; label: string; icon: string }[] = [
  { key: "fridge", label: "Fridge", icon: "🧊" },
  { key: "freezer", label: "Freezer", icon: "❄️" },
  { key: "pantry", label: "Cupboard", icon: "🗄️" },
];

export default async function PantryPage() {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const { data } = await session.supabase
    .from("pantry_items")
    .select("*")
    .eq("household_id", session.household.id)
    .is("used_up_at", null)
    .order("expires_on", { ascending: true, nullsFirst: false });
  const items = (data ?? []) as PantryItem[];
  const soon = items.filter((i) => {
    const d = daysUntil(i.expires_on, today);
    return d !== null && d <= 3;
  });
  const groceriesOn = session.isModuleEnabled("groceries");

  return (
    <div className="space-y-4">
      {soon.length ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-danger/40">
          <p className="text-sm">
            ⏳ <strong>{soon.length}</strong> item{soon.length === 1 ? "" : "s"} expiring within 3 days: {soon.slice(0, 5).map((i) => i.name).join(", ")}
            {soon.length > 5 ? "…" : ""}
          </p>
          <Link href="/food/ideas?mode=expiring" className={buttonClass("primary", "sm")}>✨ Cook something with them</Link>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/pantry/scan" className={buttonClass("secondary", "sm")}>📷 Scan receipt or shelf</Link>
      </div>
      <AddPantryForm />

      {items.length === 0 ? (
        <EmptyState title="Pantry is empty">Scan a grocery receipt or a photo of your fridge to fill it in seconds.</EmptyState>
      ) : (
        LOCATIONS.map((loc) => {
          const list = items.filter((i) => i.location === loc.key);
          if (!list.length) return null;
          return (
            <section key={loc.key}>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {loc.icon} {loc.label} ({list.length})
              </h2>
              <ul className="space-y-1.5">
                {list.map((i) => {
                  const d = daysUntil(i.expires_on, today);
                  return (
                    <li key={i.id} className="rounded-xl border border-border bg-surface px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            <span aria-hidden>{CATEGORY_META[i.category].icon}</span> {i.name}
                            {i.quantity ? <span className="text-fg-muted"> · {i.quantity}</span> : null}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {d !== null ? (
                              <Badge tone={d < 0 ? "danger" : d <= 3 ? "warn" : "neutral"}>
                                {d < 0 ? `expired ${shortDate(i.expires_on!)}` : d === 0 ? "expires today" : `${i.expiry_estimated ? "~" : ""}${d} day${d === 1 ? "" : "s"} left`}
                              </Badge>
                            ) : null}
                            {i.opened ? <Badge>opened</Badge> : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <form action={markUsedUp.bind(null, i.id, false)}>
                            <button className={buttonClass("ghost", "sm")}>Used up</button>
                          </form>
                          {groceriesOn ? (
                            <form action={markUsedUp.bind(null, i.id, true)}>
                              <button className={buttonClass("ghost", "sm")} title="Mark used up and add to the grocery list">Used up + rebuy</button>
                            </form>
                          ) : null}
                          <details className="relative">
                            <summary className={cx(buttonClass("ghost", "sm"), "list-none")}>⋯</summary>
                            <div className="absolute right-0 z-10 mt-1 w-56 space-y-2 rounded-xl border border-border bg-surface p-3 shadow-lg">
                              <form action={setExpiry.bind(null, i.id)} className="flex gap-1">
                                <input type="date" name="expires_on" defaultValue={i.expires_on ?? ""} className="h-8 flex-1 rounded-lg border border-border bg-surface px-2 text-sm" aria-label="Expiry date" />
                                <button className={buttonClass("secondary", "sm")}>Set</button>
                              </form>
                              <form action={setOpened.bind(null, i.id, !i.opened)}>
                                <button className="text-sm">{i.opened ? "Mark unopened" : "Mark opened"}</button>
                              </form>
                              <form action={deletePantryItem.bind(null, i.id)}>
                                <button className="text-sm text-danger">Remove</button>
                              </form>
                            </div>
                          </details>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
