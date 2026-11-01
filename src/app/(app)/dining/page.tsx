import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { DiningDish, DiningOrder, DiningPlace } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { AddDishForm, AddPlaceForm, LogOrderForm, WhatToOrder } from "./client";
import { deleteDish, deletePlace, toggleFavoritePlace } from "./actions";

export const metadata = { title: "Takeout & dining" };

export default async function DiningPage() {
  const session = await getSession();
  const [{ data: p }, { data: d }, { data: o }] = await Promise.all([
    session.supabase.from("dining_places").select("*").eq("household_id", session.household.id).order("favorite", { ascending: false }).order("name"),
    session.supabase.from("dining_dishes").select("*").eq("household_id", session.household.id).order("name"),
    session.supabase.from("dining_orders").select("*").eq("household_id", session.household.id).order("ordered_on", { ascending: false }).limit(15),
  ]);
  const places = (p ?? []) as DiningPlace[];
  const dishes = (d ?? []) as DiningDish[];
  const orders = (o ?? []) as DiningOrder[];
  const members = session.members.map((m) => ({ id: m.user_id, name: m.display_name }));
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "";

  return (
    <div className="space-y-4">
      {places.length ? (
        <WhatToOrder members={members} me={session.userId} defaultUseHealth={session.profile.ai_use_medical_history} canLog={session.isModuleEnabled("food_diary")} />
      ) : null}
      <AddPlaceForm />
      {places.length === 0 ? (
        <EmptyState title="No places yet">Add your go-to spots (e.g. Good Flippin&apos; Burgers, Doolally) and the dishes you usually order.</EmptyState>
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
                  {list.length ? (
                    <ul className="divide-y divide-border text-sm">
                      {list.map((x) => (
                        <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
                          <span>
                            {x.veg === true ? "🟢 " : x.veg === false ? "🔴 " : ""}{x.name}
                            <span className="text-xs text-fg-muted">
                              {x.price != null ? ` · ₹${x.price}` : ""}{x.calories ? ` · ~${x.calories} kcal` : ""}
                            </span>
                            {x.go_to_for.map((id) => (
                              <span key={id}> <Badge tone="accent">{nameOf(id)}&apos;s go-to</Badge></span>
                            ))}
                          </span>
                          <form action={deleteDish.bind(null, x.id)}>
                            <button className="text-xs text-fg-muted hover:text-danger" aria-label={`Delete ${x.name}`}>✕</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <details>
                    <summary className="cursor-pointer text-sm text-fg-muted">+ Add a dish</summary>
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
