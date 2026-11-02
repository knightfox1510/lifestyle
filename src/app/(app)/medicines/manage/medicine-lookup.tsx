"use client";

import { useState } from "react";
import { Camera, Sparkles } from "lucide-react";
import { Field, Input, Notice, cx } from "@/components/ui";
import { compressImage } from "@/lib/compress-image";
import { NUTRIENT_META, type NutrientKey } from "@/modules/nutrition/nutrients";
import type { MedicineInfo } from "@/lib/ai/health-schemas";

/** The vitamins/minerals a medicine can carry (no calories/protein for tablets). */
export const MED_NUTRIENT_KEYS: NutrientKey[] = ["calcium_mg", "vit_d_mcg", "iron_mg", "folate_mcg", "b12_mcg", "zinc_mg", "magnesium_mg", "vit_c_mg", "vit_a_mcg"];

/** "✨ Look up" (from the name) or a photo of the strip → composition, form and nutrients per unit. */
export function MedicineLookupButtons({ name, strength, onResult }: { name: string; strength: string; onResult: (info: MedicineInfo) => void }) {
  const [busy, setBusy] = useState<"name" | "photo" | null>(null);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);

  async function run(kind: "name" | "photo", photo?: File) {
    setBusy(kind);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("strength", strength);
      if (photo) fd.set("photo", await compressImage(photo, 1600));
      const res = await fetch("/api/ai/medicine-info", { method: "POST", body: fd });
      const body = (await res.json()) as MedicineInfo & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Lookup failed");
      if (!body.recognised && !body.ingredients) {
        setMsg({ tone: "danger", text: "AI wasn't sure which medicine this is. Try the exact name on the strip, or add a photo of it." });
        return;
      }
      onResult(body);
      setMsg({
        tone: "accent",
        text: [body.ingredients, body.used_for && `Usually for ${body.used_for}.`, body.note, "Check against the strip before saving."].filter(Boolean).join(" · "),
      });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 sm:col-span-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy) || !name.trim()}
          onClick={() => run("name")}
          className={cx("pressable inline-flex h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-sm font-medium text-accent", (busy || !name.trim()) && "opacity-60")}
        >
          <Sparkles className="size-4" aria-hidden /> {busy === "name" ? "Looking up…" : "Look up composition with AI"}
        </button>
        <label className={cx("pressable inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-medium", busy && "opacity-60")}>
          <Camera className="size-4" aria-hidden /> {busy === "photo" ? "Reading…" : "Photo of strip / box"}
          <input type="file" accept="image/*" className="sr-only" disabled={Boolean(busy)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run("photo", f); }} />
        </label>
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </div>
  );
}

/** Per-unit vitamins and minerals; counted in the food diary's totals for every dose marked taken. */
export function MedicineNutrientFields({ values, unit, onChange }: { values: Record<string, string>; unit: string; onChange: (v: Record<string, string>) => void }) {
  const any = MED_NUTRIENT_KEYS.some((k) => Number(values[k]) > 0);
  return (
    <details open={any} className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Vitamins & minerals per {unit || "unit"} {any ? <span className="font-normal text-fg-muted">· counted in your daily nutrients when taken</span> : <span className="font-normal text-fg-muted">(for calcium, D3, iron, B12… tablets)</span>}
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MED_NUTRIENT_KEYS.map((k) => (
          <Field key={k} label={`${NUTRIENT_META[k].label} (${NUTRIENT_META[k].unit})`}>
            <Input type="number" min={0} step="any" inputMode="decimal" value={values[k] ?? ""} onChange={(e) => onChange({ ...values, [k]: e.target.value })} />
          </Field>
        ))}
      </div>
    </details>
  );
}
