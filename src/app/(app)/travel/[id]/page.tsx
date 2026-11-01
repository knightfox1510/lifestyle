import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { addDays, todayIn } from "@/lib/dates";
import { Badge, Card, buttonClass, cx } from "@/components/ui";
import type { PackingItem, PackingTemplate, Trip, TripItem } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { daysUntil } from "@/modules/pantry/match";
import { BUILTIN_TEMPLATES, ITEM_META } from "@/modules/travel/templates";
import { PackingList, TripItemForm, TripPlanner } from "../client";
import { deleteTrip, deleteTripItem, saveAsTemplate, setTripStatus, toggleBooked } from "../actions";

export default async function TripPage({ params }: PageProps<"/travel/[id]">) {
  const { id } = await params;
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const { data: t } = await session.supabase.from("trips").select("*").eq("id", id).eq("household_id", session.household.id).maybeSingle();
  if (!t) notFound();
  const trip = t as Trip;
  const [{ data: it }, { data: pk }, { data: tpl }] = await Promise.all([
    session.supabase.from("trip_items").select("*").eq("trip_id", id).order("day_date", { ascending: true, nullsFirst: false }).order("start_time", { ascending: true, nullsFirst: true }),
    session.supabase.from("trip_packing").select("*").eq("trip_id", id).order("created_at"),
    session.supabase.from("packing_templates").select("id, name").eq("household_id", session.household.id),
  ]);
  const items = (it ?? []) as TripItem[];
  const packing = (pk ?? []) as PackingItem[];
  const days: string[] = [];
  if (trip.start_date && trip.end_date) for (let d = trip.start_date; d <= trip.end_date && days.length < 60; d = addDays(d, 1)) days.push(d);
  const unscheduled = items.filter((i) => !i.day_date);
  const spent = items.reduce((a, i) => a + Number(i.cost ?? 0), 0);
  const left = daysUntil(trip.start_date, today);
  const templates = [...BUILTIN_TEMPLATES.map((b) => ({ key: b.key, name: b.name })), ...((tpl ?? []) as Pick<PackingTemplate, "id" | "name">[]).map((x) => ({ key: x.id, name: x.name }))];
  const members = session.members.map((m) => ({ id: m.user_id, name: m.display_name }));
  const dayList = [...new Set([...days, ...items.filter((i) => i.day_date).map((i) => i.day_date!)])].sort();

  const ItemRow = ({ i }: { i: TripItem }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
      <span className="min-w-0">
        {i.start_time ? <span className="mr-1.5 font-mono text-fg-muted">{i.start_time}</span> : null}
        {ITEM_META[i.kind].icon} {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer" className="underline">{i.title}</a> : i.title}
        <span className="text-xs text-fg-muted">{i.location ? ` · ${i.location}` : ""}{i.cost != null ? ` · ${trip.currency} ${Number(i.cost).toLocaleString("en-IN")}` : ""}{i.notes ? ` · ${i.notes}` : ""}</span>
      </span>
      <span className="flex items-center gap-1">
        {["flight", "stay", "transport", "activity"].includes(i.kind) ? (
          <form action={toggleBooked.bind(null, i.id, !i.booked)}>
            <button className={cx("rounded-full px-2 py-0.5 text-xs", i.booked ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-muted")}>{i.booked ? "booked ✓" : "not booked"}</button>
          </form>
        ) : null}
        <form action={deleteTripItem.bind(null, i.id)}><button className="px-1 text-xs text-fg-muted hover:text-danger" aria-label="Delete">✕</button></form>
      </span>
    </li>
  );

  return (
    <div className="space-y-4">
      <Link href="/travel" className="text-sm text-fg-muted hover:text-fg">← All trips</Link>
      <Card className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{trip.title}</h2>
            <p className="text-sm text-fg-muted">
              {trip.destination ?? ""}{trip.start_date ? ` · ${formatDate(trip.start_date)}${trip.end_date ? ` – ${formatDate(trip.end_date)}` : ""}` : " · dates TBD"}
              {left !== null && left > 0 ? ` · in ${left} days` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["idea", "planning", "booked", "done"] as const).map((s) => (
              <form key={s} action={setTripStatus.bind(null, trip.id, s)}>
                <button className={cx("rounded-full px-2.5 py-1 text-xs", trip.status === s ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted")}>{s}</button>
              </form>
            ))}
          </div>
        </div>
        {trip.budget ? (
          <p className="text-sm">Budget {trip.currency} {Number(trip.budget).toLocaleString("en-IN")} · planned costs {trip.currency} {spent.toLocaleString("en-IN")} {spent > Number(trip.budget) ? <Badge tone="danger">over budget</Badge> : null}</p>
        ) : spent ? <p className="text-sm">Planned costs {trip.currency} {spent.toLocaleString("en-IN")}</p> : null}
      </Card>

      <TripPlanner tripId={trip.id} defaultUseHealth={session.profile.ai_use_medical_history} />

      <Card className="space-y-3">
        <h2 className="font-semibold">Itinerary</h2>
        {dayList.map((d) => {
          const list = items.filter((i) => i.day_date === d);
          return (
            <div key={d}>
              <p className="text-sm font-medium">{formatDate(d)}</p>
              {list.length ? <ul className="divide-y divide-border">{list.map((i) => <ItemRow key={i.id} i={i} />)}</ul> : <p className="text-xs text-fg-muted">Free day</p>}
            </div>
          );
        })}
        {unscheduled.length ? (
          <div>
            <p className="text-sm font-medium">Ideas & links</p>
            <ul className="divide-y divide-border">{unscheduled.map((i) => <ItemRow key={i.id} i={i} />)}</ul>
          </div>
        ) : null}
        <details>
          <summary className="cursor-pointer text-sm text-accent">+ Add a plan, link or booking</summary>
          <div className="mt-2"><TripItemForm tripId={trip.id} days={days} /></div>
        </details>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Packing</h2>
        <PackingList tripId={trip.id} items={packing} members={members} templates={templates} />
        {packing.length ? (
          <form action={saveAsTemplate.bind(null, trip.id)} className="flex items-center gap-2 border-t border-border pt-3">
            <input name="name" required maxLength={80} placeholder="Save this list as a template…" className="h-8 flex-1 rounded-lg border border-border bg-surface px-2 text-sm" aria-label="Template name" />
            <button className={buttonClass("secondary", "sm")}>Save template</button>
          </form>
        ) : null}
      </Card>

      <form action={deleteTrip.bind(null, trip.id)}>
        <button className={buttonClass("danger", "sm")}>Delete trip</button>
      </form>
    </div>
  );
}
