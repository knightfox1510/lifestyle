"use client";

import { useToast } from "@/components/toaster";

import { useState, useTransition } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { PeoplePortions, type PersonPortion } from "@/components/nutrition-ui";
import type { Meal } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, eatenAtFor, mealForHour, type LogDay } from "@/modules/food/meta";
import { forGrams, type Nutrients } from "@/modules/nutrition/nutrients";
import { toGrams, unitsFor, type Unit } from "@/modules/nutrition/measures";

/** "2 katori", "150 g (weighed whole)", "1 medium banana". */
function quantityText(amount: number, unit: Unit) {
  if (unit.key === "g") return `${amount} g`;
  if (unit.key === "ml") return `${amount} ml`;
  if (unit.key === "whole_g") return `${amount} g whole`;
  if (unit.key === "serving") return `${amount} serving${amount === 1 ? "" : "s"}`;
  if (unit.key === "piece") return `${amount} × ${unit.label.replace(/\s*\(.*\)$/, "")}`;
  return `${amount} ${unit.key}`;
}
import { logFoodForPeople } from "./actions";
import { useT } from "@/lib/i18n/client";

/** Log an amount of a food with per-100 g data (packaged product, own food). */
export function FoodAmountLogger({
  name,
  per100,
  servingG,
  servingLabel,
  irritants,
  accuracy,
  me,
  people,
  meal: presetMeal,
  day,
  onLogged,
  stapleKey,
  liquid,
}: {
  name: string;
  per100: Nutrients;
  servingG: number | null;
  servingLabel?: string | null;
  irritants: string[];
  accuracy: "label" | "calculated";
  me: string;
  people: PersonPortion[];
  /** Preset meal (from a meal card's Add) and the diary day being filled in. */
  meal?: Meal;
  day?: LogDay;
  onLogged?: () => void;
  /** Built-in food key, for its piece weight, peel/seed share and density. */
  stapleKey?: string | null;
  /** Poured by ml (drinks); assumed 1 g/ml unless the food's density is known. */
  liquid?: boolean;
}) {
  const [label, setLabel] = useState(name);
  const units = unitsFor({ stapleKey, servingG, servingLabel, liquid });
  const [unitKey, setUnitKey] = useState<string>(servingG ? "serving" : units.some((u) => u.key === "piece") ? "piece" : "g");
  const unit = units.find((u) => u.key === unitKey) ?? units[0];
  const [amount, setAmount] = useState(unitKey === "g" ? 100 : 1);
  const [meal, setMeal] = useState<Meal>(() => presetMeal ?? mealForHour(new Date().getHours()));
  const [who, setWho] = useState<Record<string, number>>({ [me]: 1 });
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const t = useT();
  const grams = toGrams(amount, unit);
  const n = forGrams(per100, grams);

  return (
    <div className="space-y-2">
      <Field label={t("Name in your diary")}>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("Amount")} className="w-24">
          <Input type="number" min={0} step={unit.grams === 1 || unit.key === "whole_g" ? 5 : 0.5} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label={t("Unit")} className="min-w-40 flex-1">
          <Select
            value={unit.key}
            onChange={(e) => {
              const next = units.find((u) => u.key === e.target.value) ?? units[0];
              // Keep the same amount of food when switching units.
              const gramLike = next.key === "g" || next.key === "ml" || next.key === "whole_g";
              const raw = grams / next.grams;
              setAmount((gramLike ? Math.round(raw) : Math.round(raw * 4) / 4) || (gramLike ? 100 : 1));
              setUnitKey(next.key);
            }}
          >
            {units.map((u) => (
              <option key={u.key} value={u.key}>{t(u.label)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("Meal")} className="w-32">
          <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEAL_ORDER.map((m) => (
              <option key={m} value={m}>{t(MEAL_META[m].label)}</option>
            ))}
          </Select>
        </Field>
      </div>
      {unit.note ? <p className="text-xs text-fg-muted">{t(unit.note)}</p> : null}
      <p className="text-xs text-fg-muted">
        {Math.round(grams)} g {unit.key === "whole_g" || unit.key === "piece" ? t("edible") : ""} → <strong className="text-fg">{Math.round(n.calories ?? 0)} kcal</strong> · P {n.protein_g ?? "–"} · C {n.carbs_g ?? "–"} · F {n.fat_g ?? "–"}
        {n.sodium_mg != null ? ` · sodium ${Math.round(n.sodium_mg)} mg` : ""}
      </p>
      <PeoplePortions people={people} value={who} onChange={setWho} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button
        size="sm"
        disabled={pending || grams <= 0 || !label.trim() || !Object.values(who).some((v) => v > 0)}
        onClick={() =>
          start(async () => {
            const r = await logFoodForPeople(
              Object.entries(who).filter(([, f]) => f > 0).map(([ownerId, factor]) => ({ ownerId, factor })),
              meal,
              [{ description: label.trim(), quantity: quantityText(amount, unit), grams, nutrients: n as Record<string, number>, accuracy, irritants, source: "manual" }],
              eatenAtFor(day, meal),
            );
            setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Logged." });
            if (!r.error) {
              toast(r.message ?? "Logged.", { kind: "food" });
              onLogged?.();
            }
          })
        }
      >
        {t("Log it")}
      </Button>
    </div>
  );
}
