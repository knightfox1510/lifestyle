import { getSession } from "@/lib/session";
import { Card, EmptyState, buttonClass } from "@/components/ui";
import type { DiningDish, DiningOrder, DiningPlace } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { AddDishForm, AddPlaceForm, LogOrderForm, WhatToOrder } from "./client";
import { PlaceMenu } from "./place-menu";
import { deletePlace, toggleFavoritePlace } from "./actions";

export const metadata = { title: "Takeout & dining" };

export default async function DiningPage() {
  const session = await getSession();
  const [{ data: p }, { data: d }, { data: o }] = await Promise.all([
    session.supabase.from("dining_places").select("*").eq("household_id", session.household.id).order("favorite", { ascending: false }).order("name"),
    session.supabase.from("dining_dishes").select("*").eq("household_id", session.household.id).order("section", { ascending: true, nullsFirst: false }).order("name"),
    session.supabase.from("dining_orders").select("*").eq("household_id", session.household.id).order("ordered_on", { ascending: false }).limit(15),
  ]);
  const places = (p ?? []) as DiningPlace[];
  const dishes = (d ?? []) as DiningDish[];
  const orders = (o ?? []) as DiningOrder[];
  const members = session.members.map((m) => ({ id: m.user_id, name: m.display_name }));
  const canLog = session.isModuleEnabled("food_diary");
  const placeRefs = places.map((x) => ({ id: x.id, name: x.name }));
  const dishRefs = dishes.map((x) => ({ id: x.id, name: x.name, place_id: x.place_id }));

  return (
    <div className="space-y-4">
      {places.length ? (
        <WhatToOrder members={members} me={session.userId} defaultUseHealth={session.profile.ai_use_medical_history} canLog={canLog} places={placeRefs} dishes={dishRefs} />
      ) : null}
      <AddPlaceForm />
      {places.length === 0 ? (
        <EmptyState title="No places yet">Add your go-to spots (e.g. Good Flippin&apos; Burgers, Doolally), then import each menu from Zomato/Swiggy screenshots or a photo.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {places.map((pl) => {
            const list = dishes.filter((x) => x.place_id === pl.id);
            return (
              <li key={pl.id}>
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{pl.favorite ? "★ " : ""}{pl.name}</p>
                      <p className="text-xs text-fg-muted">{[pl.cuisine, pl.area, pl.mode.replace("_", "-"), pl.order_via].filter(Boolean).join(" · ")}</p>
                      {pl.notes ? <p className="text-xs text-fg-muted">{pl.notes}</p> : null}
                    </div>
                    <div className="flex gap-1">
                      <form action={toggleFavoritePlace.bind(null, pl.id, !pl.favorite)}>
                        <button className={buttonClass("ghost", "sm")} aria-label={pl.favorite ? "Unfavourite" : "Favourite"}>{pl.favorite ? "★" : "☆"}</button>
                      </form>
                      <form action={deletePlace.bind(null, pl.id)}>
                        <button className={buttonClass("ghost", "sm")} aria-label={`Delete ${pl.name}`}>✕</button>
                      </form>
                    </div>
                  </div>
                  <PlaceMenu placeId={pl.id} placeName={pl.name} dishes={list} members={members} me={session.userId} canLog={canLog} />
                  <details>
                    <summary className="cursor-pointer text-sm text-accent">✨ Suggest from here</summary>
                    <div className="mt-2">
                      <WhatToOrder members={members} me={session.userId} defaultUseHealth={session.profile.ai_use_medical_history} canLog={canLog} places={placeRefs} dishes={dishRefs} placeId={pl.id} />
                    </div>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-sm text-fg-muted">+ Add a dish by hand</summary>
                    <div className="mt-2"><AddDishForm placeId={pl.id} members={members} /></div>
                  </details>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {places.length ? (
        <Card className="space-y-3">
          <h2 className="font-semibold">Orders</h2>
          <LogOrderForm places={places.map((x) => ({ id: x.id, name: x.name }))} />
          {orders.length ? (
            <ul className="divide-y divide-border text-sm">
              {orders.map((x) => (
                <li key={x.id} className="flex justify-between gap-2 py-1.5">
                  <span>{x.items} <span className="text-fg-muted">· {places.find((pl) => pl.id === x.place_id)?.name ?? "elsewhere"}</span>{x.rating ? ` · ${"★".repeat(x.rating)}` : ""}</span>
                  <span className="shrink-0 text-fg-muted">{formatDate(x.ordered_on)}{x.total != null ? ` · ₹${x.total}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
