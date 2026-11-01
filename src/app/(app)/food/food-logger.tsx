"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { PeoplePortions, type PersonPortion } from "@/components/nutrition-ui";
import type { Meal } from "@/lib/types";
import { MEAL_META, MEAL_ORDER, mealForHour } from "@/modules/food/meta";
import { forGrams, type Nutrients } from "@/modules/nutrition/nutrients";
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
}: {
  name: string;
  per100: Nutrients;
  servingG: number | null;
  servingLabel?: string | null;
  irritants: string[];
  accuracy: "label" | "calculated";
  me: string;
  people: PersonPortion[];
}) {
  const [unit, setUnit] = useState<"g" | "serving">(servingG ? "serving" : "g");
  const [amount, setAmount] = useState(servingG ? 1 : 100);
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours()));
  const [who, setWho] = useState<Record<string, number>>({ [me]: 1 });
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const t = useT();
  const grams = unit === "g" ? amount : amount * (servingG ?? 0);
  const n = forGrams(per100, grams);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("Amount")} className="w-24">
          <Input type="number" min={0} step={unit === "g" ? 5 : 0.5} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label={t("Unit")} className="w-36">
          <Select value={unit} onChange={(e) => { const u = e.target.value as "g" | "serving"; setUnit(u); setAmount(u === "g" ? 100 : 1); }}>
            <option value="g">{t("grams / ml")}</option>
            {servingG ? <option value="serving">{t("servings")} ({servingLabel || `${servingG} g`})</option> : null}
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
      <p className="text-xs text-fg-muted">
        {Math.round(grams)} g → <strong className="text-fg">{Math.round(n.calories ?? 0)} kcal</strong> · P {n.protein_g ?? "–"} · C {n.carbs_g ?? "–"} · F {n.fat_g ?? "–"}
        {n.sodium_mg != null ? ` · sodium ${Math.round(n.sodium_mg)} mg` : ""}
      </p>
      <PeoplePortions people={people} value={who} onChange={setWho} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button
        size="sm"
        disabled={pending || grams <= 0 || !Object.values(who).some((v) => v > 0)}
        onClick={() =>
          start(async () => {
            const r = await logFoodForPeople(
              Object.entries(who).filter(([, f]) => f > 0).map(([ownerId, factor]) => ({ ownerId, factor })),
              meal,
              [{ description: name, quantity: unit === "g" ? `${amount} g` : `${amount} serving${amount === 1 ? "" : "s"}`, grams, nutrients: n as Record<string, number>, accuracy, irritants, source: "manual" }],
            );
            setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Logged." });
          })
        }
      >
        {t("Log it")}
      </Button>
    </div>
  );
}
