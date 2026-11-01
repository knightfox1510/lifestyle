"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Notice } from "@/components/ui";
import type { PersonPortion } from "@/components/nutrition-ui";
import { searchDishes, type Dish } from "@/modules/nutrition/dishes";
import { IRRITANT_META, type Irritant } from "@/modules/nutrition/irritants";
import type { Nutrients } from "@/modules/nutrition/nutrients";
import { FoodAmountLogger } from "../food-logger";
import { copyDishToRecipes } from "@/app/(app)/recipes/actions";
import { useT } from "@/lib/i18n/client";

export type DishView = Pick<Dish, "key" | "name" | "aliases" | "region" | "serving" | "servingG"> & { irritants: string[]; perServing: Nutrients; per100: Nutrients };

export function DishBrowser({ dishes, me, people, canLog, recipesOn }: { dishes: DishView[]; me: string; people: PersonPortion[]; canLog: boolean; recipesOn: boolean }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();

  const groups = useMemo(() => {
    const list = q.trim() ? searchDishes(q, 30).map((d) => dishes.find((x) => x.key === d.key)!).filter(Boolean) : dishes;
    if (q.trim()) return [["Matches", list] as const];
    const by = new Map<string, DishView[]>();
    for (const d of list) by.set(d.region, [...(by.get(d.region) ?? []), d]);
    return [...by.entries()];
  }, [q, dishes]);

  return (
    <div className="space-y-4">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search dishes, e.g. dosa, misal, matki chi bhaji…")} aria-label={t("Search dishes")} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {groups.length === 0 || groups.every(([, l]) => l.length === 0) ? (
        <p className="text-sm text-fg-muted">{t("No built-in dish matches. Describe it in the diary's ✨ Calculate box instead — it breaks any dish into ingredients.")}</p>
      ) : null}
      {groups.map(([region, list]) =>
        list.length ? (
          <section key={region} className="space-y-2">
            <h2 className="text-sm font-semibold text-fg-muted">{t(region)}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((d) => (
                <li key={d.key}>
                  <Card className="space-y-2 !p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-fg-muted">{d.serving} · ~{d.servingG} g</p>
                      </div>
                      <Badge tone="accent">{Math.round(d.perServing.calories ?? 0)} kcal</Badge>
                    </div>
                    <p className="text-xs text-fg-muted">
                      P {d.perServing.protein_g ?? 0} g · C {d.perServing.carbs_g ?? 0} g · F {d.perServing.fat_g ?? 0} g · fibre {d.perServing.fiber_g ?? 0} g
                      {d.perServing.iron_mg != null ? ` · iron ${d.perServing.iron_mg} mg` : ""}
                    </p>
                    {d.irritants.length ? (
                      <p className="text-xs text-fg-muted">{t("Bladder irritants")}: {d.irritants.map((x) => `${IRRITANT_META[x as Irritant]?.icon ?? ""} ${t(IRRITANT_META[x as Irritant]?.label ?? x)}`).join(", ")}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                      {canLog ? (
                        <details className="w-full">
                          <summary className="cursor-pointer text-sm text-accent">{t("Log it")}</summary>
                          <div className="mt-2">
                            <FoodAmountLogger name={d.name} per100={d.per100} servingG={d.servingG} servingLabel={d.serving} irritants={d.irritants} accuracy="calculated" me={me} people={people} />
                          </div>
                        </details>
                      ) : null}
                      {recipesOn ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await copyDishToRecipes(d.key);
                              if (r.error) setMsg({ tone: "danger", text: r.error });
                              else if (r.id) router.push(`/recipes/${r.id}`);
                            })
                          }
                        >
                          {t("Copy to my recipes")}
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
