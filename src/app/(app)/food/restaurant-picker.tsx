"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, Field, Notice, Select } from "@/components/ui";
import type { Meal } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, mealForHour, eatenAtFor, type LogDay } from "@/modules/food/meta";
import { portionOptions } from "@/modules/dining/menu";
import { logDish } from "@/app/(app)/dining/actions";

type Dish = { id: string; name: string; place_id: string; calories: number | null; section: string | null };

/** Log a saved restaurant dish (from Dining menus) to the food diary. */
export function RestaurantPicker({ ownerId, places, dishes, day }: { ownerId: string; places: { id: string; name: string }[]; dishes: Dish[]; day?: LogDay }) {
  const [open, setOpen] = useState(false);
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "");
  const [dishId, setDishId] = useState("");
  const [portion, setPortion] = useState("full");
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours()));
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const portions = portionOptions();
  const list = useMemo(() => dishes.filter((d) => d.place_id === placeId), [dishes, placeId]);
  const dish = list.find((d) => d.id === dishId);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-fg-muted hover:text-fg">
        🍔 From a restaurant menu
      </button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Restaurant">
          <Select value={placeId} onChange={(e) => { setPlaceId(e.target.value); setDishId(""); }}>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Dish">
          <Select value={dishId} onChange={(e) => setDishId(e.target.value)}>
            <option value="">{list.length ? "Choose a dish…" : "No menu saved (import it in Dining)"}</option>
            {list.map((d) => (
              <option key={d.id} value={d.id}>{d.section ? `${d.section} · ` : ""}{d.name}{d.calories ? ` · ${d.calories} kcal` : ""}</option>
            ))}
          </Select>
        </Field>
        <Field label="Portion">
          <Select value={portion} onChange={(e) => setPortion(e.target.value)}>
            {portions.map((p) => (
              <option key={p.key} value={p.key}>{p.label}{dish?.calories ? ` · ${Math.round(dish.calories * p.factor)} kcal` : ""}</option>
            ))}
          </Select>
        </Field>
        <Field label="Meal">
          <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEAL_ORDER.map((m) => (
              <option key={m} value={m}>{MEAL_META[m].label}</option>
            ))}
          </Select>
        </Field>
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex gap-2">
        <Button
          disabled={!dishId || pending}
          onClick={() =>
            start(async () => {
              const r = await logDish(dishId, ownerId, meal, portions.find((p) => p.key === portion)?.factor ?? 1, eatenAtFor(day, meal));
              setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Logged." });
              if (!r.error) setDishId("");
            })
          }
        >
          Add
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </Card>
  );
}
