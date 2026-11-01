import Link from "next/link";
import { getSession } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { PackingTemplate, Trip } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { daysUntil } from "@/modules/pantry/match";
import { AddTripForm } from "./client";
import { deleteTemplate } from "./actions";

export const metadata = { title: "Travel" };

export default async function TravelPage() {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const [{ data }, { data: tpl }] = await Promise.all([
    session.supabase.from("trips").select("*").eq("household_id", session.household.id).order("start_date", { ascending: true, nullsFirst: false }),
    session.supabase.from("packing_templates").select("*").eq("household_id", session.household.id).order("name"),
  ]);
  const trips = (data ?? []) as Trip[];
  const upcoming = trips.filter((t) => t.status !== "done" && (!t.end_date || t.end_date >= today));
  const past = trips.filter((t) => !upcoming.includes(t));
  const templates = (tpl ?? []) as PackingTemplate[];

  const TripCard = ({ t }: { t: Trip }) => {
    const left = daysUntil(t.start_date, today);
    return (
      <Link href={`/travel/${t.id}`}>
        <Card className="h-full space-y-1 hover:bg-surface-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{t.title}</p>
            <Badge tone={t.status === "booked" ? "accent" : "neutral"}>{t.status}</Badge>
          </div>
          <p className="text-sm text-fg-muted">
            {t.destination ?? ""}
            {t.start_date ? ` · ${formatDate(t.start_date)}${t.end_date ? ` – ${formatDate(t.end_date)}` : ""}` : " · dates TBD"}
          </p>
          {left !== null && left > 0 && t.status !== "done" ? <p className="text-xs text-accent">in {left} days</p> : null}
        </Card>
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <AddTripForm />
      {trips.length === 0 ? (
        <EmptyState title="No trips yet">Start with an idea, like “Japan” or “South Korea”, and collect links and plans together.</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">{upcoming.map((t) => <TripCard key={t.id} t={t} />)}</div>
          {past.length ? (
            <details>
              <summary className="cursor-pointer text-sm text-fg-muted">Past trips ({past.length})</summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">{past.map((t) => <TripCard key={t.id} t={t} />)}</div>
            </details>
          ) : null}
        </>
      )}
      {templates.length ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Your packing templates</h2>
          <ul className="space-y-1 text-sm">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between">
                <span>{t.name} <span className="text-fg-muted">· {t.items.length} items</span></span>
                <form action={deleteTemplate.bind(null, t.id)}><button className={buttonClass("ghost", "sm")}>Delete</button></form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
