"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui";
import { toGrams, unitsFor } from "@/modules/nutrition/measures";

/** Amount + unit (g, katori, cup, tbsp, pieces, weighed whole…) that reports edible grams. */
export function MeasureInput({ grams, onGrams, stapleKey, label }: { grams: number; onGrams: (g: number) => void; stapleKey?: string | null; label: string }) {
  const units = unitsFor({ stapleKey });
  const [unitKey, setUnitKey] = useState("g");
  const unit = units.find((u) => u.key === unitKey) ?? units[0];
  const [amount, setAmount] = useState<number>(grams);
  // Keep in step when grams are changed from outside (e.g. a new match).
  const shown = unitKey === "g" ? grams : amount;
  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="number"
        min={0}
        step={unit.grams === 1 || unit.key === "whole_g" ? 1 : 0.25}
        value={shown}
        onChange={(e) => {
          const a = Math.max(0, Number(e.target.value) || 0);
          setAmount(a);
          onGrams(toGrams(a, unit));
        }}
        className="!h-7 w-20"
        aria-label={`${label} amount`}
      />
      <Select
        value={unitKey}
        onChange={(e) => {
          const next = units.find((u) => u.key === e.target.value) ?? units[0];
          const raw = grams / next.grams;
          setAmount(next.key === "g" || next.key === "ml" || next.key === "whole_g" ? Math.round(raw) : Math.round(raw * 4) / 4);
          setUnitKey(next.key);
        }}
        className="!h-7 !py-0 text-xs"
        aria-label={`${label} unit`}
      >
        {units.map((u) => (
          <option key={u.key} value={u.key}>{u.key === "g" ? "g" : u.label}</option>
        ))}
      </Select>
      {unitKey !== "g" ? <span className="text-fg-muted">= {Math.round(grams)} g</span> : null}
    </span>
  );
}
