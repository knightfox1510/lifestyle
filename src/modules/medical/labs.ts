import type { LabFlag, LabResult } from "@/lib/types";

/** Common markers with typical adult reference ranges (labs differ; printed ranges win). */
export const COMMON_MARKERS: { marker: string; panel: string; unit: string; low?: number; high?: number }[] = [
  { marker: "Hemoglobin", panel: "CBC", unit: "g/dL", low: 12, high: 15.5 },
  { marker: "WBC count", panel: "CBC", unit: "10^3/µL", low: 4, high: 11 },
  { marker: "Platelet count", panel: "CBC", unit: "10^3/µL", low: 150, high: 410 },
  { marker: "Ferritin", panel: "Iron studies", unit: "ng/mL", low: 15, high: 150 },
  { marker: "Serum iron", panel: "Iron studies", unit: "µg/dL", low: 60, high: 170 },
  { marker: "Fasting glucose", panel: "Diabetes", unit: "mg/dL", low: 70, high: 99 },
  { marker: "HbA1c", panel: "Diabetes", unit: "%", low: 4, high: 5.6 },
  { marker: "Fasting insulin", panel: "Diabetes", unit: "µIU/mL", low: 2, high: 25 },
  { marker: "Total cholesterol", panel: "Lipid profile", unit: "mg/dL", high: 200 },
  { marker: "LDL cholesterol", panel: "Lipid profile", unit: "mg/dL", high: 100 },
  { marker: "HDL cholesterol", panel: "Lipid profile", unit: "mg/dL", low: 50 },
  { marker: "Triglycerides", panel: "Lipid profile", unit: "mg/dL", high: 150 },
  { marker: "TSH", panel: "Thyroid", unit: "µIU/mL", low: 0.4, high: 4.0 },
  { marker: "Free T4", panel: "Thyroid", unit: "ng/dL", low: 0.8, high: 1.8 },
  { marker: "Free T3", panel: "Thyroid", unit: "pg/mL", low: 2.3, high: 4.2 },
  { marker: "Vitamin D (25-OH)", panel: "Vitamins", unit: "ng/mL", low: 30, high: 100 },
  { marker: "Vitamin B12", panel: "Vitamins", unit: "pg/mL", low: 200, high: 900 },
  { marker: "Folate", panel: "Vitamins", unit: "ng/mL", low: 3, high: 17 },
  { marker: "Creatinine", panel: "Kidney", unit: "mg/dL", low: 0.5, high: 1.1 },
  { marker: "eGFR", panel: "Kidney", unit: "mL/min/1.73m²", low: 90 },
  { marker: "Uric acid", panel: "Kidney", unit: "mg/dL", low: 2.4, high: 6 },
  { marker: "ALT (SGPT)", panel: "Liver", unit: "U/L", high: 35 },
  { marker: "AST (SGOT)", panel: "Liver", unit: "U/L", high: 35 },
  { marker: "Calcium", panel: "Minerals", unit: "mg/dL", low: 8.6, high: 10.3 },
  { marker: "Magnesium", panel: "Minerals", unit: "mg/dL", low: 1.7, high: 2.2 },
  { marker: "CRP", panel: "Inflammation", unit: "mg/L", high: 5 },
  { marker: "Urine pus cells", panel: "Urine routine", unit: "/hpf", high: 5 },
];

export function computeFlag(value: number | null, low: number | null, high: number | null): LabFlag | null {
  if (value === null) return null;
  if (low !== null && value < low) return "low";
  if (high !== null && value > high) return "high";
  if (low === null && high === null) return null;
  return "normal";
}

export function refLabel(r: Pick<LabResult, "ref_low" | "ref_high" | "ref_text">) {
  if (r.ref_text) return r.ref_text;
  if (r.ref_low !== null && r.ref_high !== null) return `${r.ref_low}–${r.ref_high}`;
  if (r.ref_low !== null) return `> ${r.ref_low}`;
  if (r.ref_high !== null) return `< ${r.ref_high}`;
  return "";
}

export function valueLabel(r: Pick<LabResult, "value" | "value_text" | "unit">) {
  return `${r.value ?? r.value_text ?? ""}${r.unit ? ` ${r.unit}` : ""}`;
}

/** Group results by marker (case-insensitive), newest first within each. */
export function byMarker(results: LabResult[]) {
  const map = new Map<string, LabResult[]>();
  for (const r of results) {
    const key = r.marker.trim().toLowerCase();
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.values()]
    .map((list) => list.sort((a, b) => b.test_date.localeCompare(a.test_date)))
    .sort((a, b) => (a[0].panel ?? "zz").localeCompare(b[0].panel ?? "zz") || a[0].marker.localeCompare(b[0].marker));
}

/**
 * Usual time before re-checking an out-of-range test (general guidance; a
 * doctor's own instruction wins). Matched on the marker's name.
 */
const RETEST_RULES: [RegExp, number, string][] = [
  [/\b(tsh|t3|t4|thyroid)\b/i, 42, "about 6 weeks"],
  [/vitamin\s*d|25.?oh|\bd3\b/i, 90, "about 3 months"],
  [/\bb.?12\b|cobalamin|folate|folic/i, 90, "about 3 months"],
  [/hba1c|glycated|a1c/i, 90, "about 3 months"],
  [/glucose|sugar|fbs|ppbs|rbs/i, 90, "about 3 months"],
  [/cholesterol|\bldl\b|\bhdl\b|triglycer|lipid|vldl/i, 180, "about 6 months"],
  [/haemoglobin|hemoglobin|\bhb\b|ferritin|\biron\b|tibc|transferrin/i, 90, "about 3 months"],
  [/creatinine|egfr|urea|\bbun\b|uric/i, 90, "about 3 months"],
  [/\b(alt|ast|sgpt|sgot|ggt|bilirubin|alkaline)\b/i, 90, "about 3 months"],
  [/\b(crp|esr)\b/i, 42, "about 6 weeks"],
];

export type Retest = { marker: string; lastDate: string; value: string; flag: LabFlag; due: string; interval: string; status: "due" | "soon" | "later" };

/**
 * Re-checks to plan: the latest result of each marker that was out of range,
 * when it's usually re-tested, and whether that's due. A newer normal result
 * closes it automatically (the latest is what counts).
 */
export function retestsDue(results: LabResult[], today: string): Retest[] {
  const out: Retest[] = [];
  for (const group of byMarker(results)) {
    const latest = group[0];
    if (!latest.flag || latest.flag === "normal") continue;
    const rule = RETEST_RULES.find(([re]) => re.test(latest.marker));
    const days = rule?.[1] ?? 90;
    const d = new Date(`${latest.test_date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    const due = d.toISOString().slice(0, 10);
    const soon = new Date(`${today}T12:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 21);
    out.push({ marker: latest.marker, lastDate: latest.test_date, value: valueLabel(latest), flag: latest.flag, due, interval: rule?.[2] ?? "about 3 months", status: due <= today ? "due" : due <= soon.toISOString().slice(0, 10) ? "soon" : "later" });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
