"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge, Button, Input, Notice, Select, cx } from "@/components/ui";
import type { DiningDish, Meal } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, mealForHour } from "@/modules/food/meta";
import { portionOptions } from "@/modules/dining/menu";
import { normalizeName } from "@/modules/pantry/match";
import { MenuImport } from "./menu-import";
import { deleteDish, logDish, updateDish, updateDishNutrition } from "./actions";
import { EditRecord } from "@/components/edit-record";

/** A restaurant's saved menu: search, sections, log a dish, import more. */
export function PlaceMenu({
  placeId,
  placeName,
  dishes,
  members,
  me,
  canLog,
}: {
  placeId: string;
  placeName: string;
  dishes: DiningDish[];
  members: { id: string; name: string }[];
  me: string;
  canLog: boolean;
}) {
  const [q, setQ] = useState("");
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState(dishes.length <= 8);
  const [logging, setLogging] = useState<string | null>(null);
  const [portion, setPortion] = useState("full");
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours()));
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const portions = portionOptions();
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "";

  const shown = useMemo(() => {
    const n = normalizeName(q);
    return n ? dishes.filter((d) => normalizeName(`${d.name} ${d.section ?? ""} ${d.description ?? ""}`).includes(n)) : dishes;
  }, [q, dishes]);
  const sections = [...new Set(shown.map((d) => d.section ?? "Other"))];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {dishes.length ? (
          <button type="button" className="text-sm font-medium" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "▾" : "▸"} Menu ({dishes.length})
          </button>
        ) : (
          <span className="text-sm text-fg-muted">No menu yet.</span>
        )}
        <Button size="sm" variant="secondary" onClick={() => setImporting(!importing)}>📸 {dishes.length ? "Import more" : "Import menu"}</Button>
      </div>
      {importing ? <MenuImport placeId={placeId} placeName={placeName} onDone={() => { setImporting(false); setOpen(true); }} /> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {open && dishes.length ? (
        <div className="space-y-2">
          {dishes.length > 8 ? <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this menu" aria-label="Search menu" className="!h-9" /> : null}
          {sections.map((sec) => (
            <div key={sec}>
              {sections.length > 1 ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{sec}</p> : null}
              <ul className="divide-y divide-border">
                {shown.filter((d) => (d.section ?? "Other") === sec).map((d) => (
                  <li key={d.id} className="py-1.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        {d.veg === true ? "🟢 " : d.veg === false ? "🔴 " : ""}{d.name}
                        <span className="text-xs text-fg-muted">
                          {d.price != null ? ` · ₹${Number(d.price).toLocaleString("en-IN")}` : ""}
                          {d.calories ? ` · ${d.nutrition_estimated ? "~" : ""}${d.calories} kcal` : ""}
                          {d.protein_g ? ` · ${Math.round(Number(d.protein_g))} g protein` : ""}
                        </span>
                        {d.go_to_for.map((id) => (
                          <span key={id}> <Badge tone="accent">{nameOf(id)}&apos;s go-to</Badge></span>
                        ))}
                        {d.description ? <span className="block truncate text-xs text-fg-muted">{d.description}</span> : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {canLog ? (
                          <button type="button" className="rounded-lg px-2 py-0.5 text-xs text-accent hover:bg-accent-soft" onClick={() => setLogging(logging === d.id ? null : d.id)}>
                            I ate this
                          </button>
                        ) : null}
                        <details className="relative">
                          <summary className="list-none rounded-lg px-1.5 text-xs text-fg-muted hover:bg-surface-2" aria-label="More">⋯</summary>
                          <div className="absolute right-0 z-10 mt-1 w-60 space-y-2 rounded-xl border border-border bg-surface p-3 shadow-lg">
                            <form action={updateDishNutrition.bind(null, d.id)} className="grid grid-cols-2 gap-1.5 text-xs">
                              {(
                                [
                                  ["price", "₹", d.price],
                                  ["calories", "kcal", d.calories],
                                  ["protein_g", "Protein g", d.protein_g],
                                  ["carbs_g", "Carbs g", d.carbs_g],
                                  ["fat_g", "Fat g", d.fat_g],
                                ] as const
                              ).map(([k, l, v]) => (
                                <label key={k} className="flex flex-col">
                                  {l}
                                  <input name={k} type="number" min={0} step="any" defaultValue={v ?? ""} className="h-7 rounded-md border border-border bg-surface px-1.5" />
                                </label>
                              ))}
                              <button className="col-span-2 rounded-md bg-accent py-1 text-accent-fg">Save numbers</button>
                            </form>
                            <EditRecord
                              iconOnly={false}
                              label="Rename / veg / notes"
                              fields={[
                                { name: "name", label: "Dish", type: "text", maxLength: 120 },
                                { name: "veg", label: "Veg?", type: "select", allowEmpty: true, options: [{ value: "veg", label: "Veg" }, { value: "nonveg", label: "Non-veg" }] },
                                { name: "price", label: "₹", type: "number", min: 0 },
                                { name: "calories", label: "kcal", type: "number", min: 0, step: 1 },
                                { name: "protein_g", label: "Protein g", type: "number", min: 0 },
                                { name: "notes", label: "Notes", type: "textarea", maxLength: 300 },
                              ]}
                              values={{ name: d.name, veg: d.veg === true ? "veg" : d.veg === false ? "nonveg" : null, price: d.price, calories: d.calories, protein_g: d.protein_g, notes: d.notes ?? null }}
                              onSave={updateDish.bind(null, d.id)}
                            />
                            <form action={deleteDish.bind(null, d.id)}>
                              <button className="text-xs text-danger">Remove from menu</button>
                            </form>
                          </div>
                        </details>
                      </span>
                    </div>
                    {logging === d.id ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-surface-2 p-2">
                        <Select value={portion} onChange={(e) => setPortion(e.target.value)} className="!h-8 w-36" aria-label="Portion">
                          {portions.map((p) => (
                            <option key={p.key} value={p.key}>{p.label}{d.calories ? ` · ${Math.round(Number(d.calories) * p.factor)} kcal` : ""}</option>
                          ))}
                        </Select>
                        <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} className="!h-8 w-28" aria-label="Meal">
                          {MEAL_ORDER.map((m) => (
                            <option key={m} value={m}>{MEAL_META[m].label}</option>
                          ))}
                        </Select>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const factor = portions.find((p) => p.key === portion)?.factor ?? 1;
                              const r = await logDish(d.id, me, meal, factor);
                              setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Logged." });
                              if (!r.error) setLogging(null);
                            })
                          }
                        >
                          Log to my diary
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {q && !shown.length ? <p className={cx("text-sm text-fg-muted")}>No dishes match “{q}”.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
