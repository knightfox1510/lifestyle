import type { LabResult } from "@/lib/types";
import type { NutrientKey } from "./nutrients";

const LINKS: [RegExp, NutrientKey][] = [
  [/vitamin\s*d|25.?oh/i, "vit_d_mcg"],
  [/b\s*-?12|cobalamin/i, "b12_mcg"],
  [/ferritin|ha?emoglobin|serum iron|\biron\b|tibc/i, "iron_mg"],
  [/calcium/i, "calcium_mg"],
  [/folate|folic/i, "folate_mcg"],
  [/magnesium/i, "magnesium_mg"],
  [/potassium/i, "potassium_mg"],
  [/zinc/i, "zinc_mg"],
  [/sodium/i, "sodium_mg"],
];

/** Latest out-of-range lab results that relate to a nutrient (e.g. low vitamin D → vitamin D intake). */
export function labNutrientLinks(labs: Pick<LabResult, "marker" | "value" | "unit" | "flag" | "test_date">[]) {
  const out = new Map<NutrientKey, { marker: string; value: string; flag: string; date: string }>();
  const latest = new Map<string, (typeof labs)[number]>();
  for (const l of labs) {
    const k = l.marker.trim().toLowerCase();
    const prev = latest.get(k);
    if (!prev || l.test_date > prev.test_date) latest.set(k, l);
  }
  for (const l of latest.values()) {
    if (!l.flag || l.flag === "normal") continue;
    const hit = LINKS.find(([re]) => re.test(l.marker));
    if (hit && !out.has(hit[1])) out.set(hit[1], { marker: l.marker, value: `${l.value ?? ""}${l.unit ? ` ${l.unit}` : ""}`.trim(), flag: l.flag, date: l.test_date });
  }
  return out;
}
