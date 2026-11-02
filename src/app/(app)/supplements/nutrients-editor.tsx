"use client";

import { useMemo, useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { compressImage } from "@/lib/compress-image";
import { NUTRIENT_META } from "@/modules/nutrition/nutrients";
import { SUPPLEMENT_KEYS, searchSupplementCatalog } from "@/modules/nutrition/supplements";
import { saveSupplementNutrients } from "./actions";

type Source = "manual" | "label" | "catalog";

/** What one dose contains: pick a common product, scan the label, or type amounts. */
export function SupplementNutrientsEditor({
  id,
  ownerId,
  name,
  initial,
  initialServing,
}: {
  id: string;
  ownerId: string;
  name: string;
  initial: Record<string, number> | null | undefined;
  initialServing: string | null | undefined;
}) {
  const t = useT();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, String(v)])));
  const [serving, setServing] = useState(initialServing ?? "");
  const [source, setSource] = useState<Source>("manual");
  const [query, setQuery] = useState(name);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hits = useMemo(() => searchSupplementCatalog(query, 5), [query]);

  const fill = (n: Record<string, number | null | undefined>, s: string | null, src: Source) => {
    setValues(Object.fromEntries(Object.entries(n).filter(([, v]) => v != null && v > 0).map(([k, v]) => [k, String(v)])));
    if (s) setServing(s);
    setSource(src);
  };

  async function scan(file: File) {
    setScanning(true);
    setNote(null);
    try {
      const fd = new FormData();
      fd.set("photo", await compressImage(file, 1600));
      const res = await fetch("/api/ai/supplement-label", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Scan failed");
      fill(body.per_serving, body.serving_label, "label");
      setNote(body.other ? `${t("Also on the label")}: ${body.other}` : t("Read from the label. Check the numbers before saving."));
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-surface-2/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("Pick a common product")} className="min-w-48 flex-1">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Shelcal, D3 60K, B12…" />
        </Field>
        <label className="pressable inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-[14px] font-medium shadow-[0_0_0_1px_var(--border)]">
          <Camera className="size-4" aria-hidden /> {scanning ? t("Reading…") : t("Scan label")}
          <input type="file" accept="image/*" className="sr-only" disabled={scanning} onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
        </label>
      </div>
      {hits.length ? (
        <div className="flex flex-wrap gap-1.5">
          {hits.map((h) => (
            <button key={h.key} type="button" className="pressable rounded-full bg-surface px-3 py-1.5 text-[13px] shadow-[0_0_0_1px_var(--border)]" onClick={() => { fill(h.nutrients as Record<string, number>, h.serving, "catalog"); setNote(t("Typical amounts for this kind of product. Check your label.")); }}>
              {h.name}
            </button>
          ))}
        </div>
      ) : null}
      {note ? <Notice tone="accent">{note}</Notice> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label={t("One dose")}>
          <Input value={serving} onChange={(e) => setServing(e.target.value)} maxLength={40} placeholder={t("1 tablet")} />
        </Field>
        {SUPPLEMENT_KEYS.map((k) => (
          <Field key={k} label={`${t(NUTRIENT_META[k].label)} (${NUTRIENT_META[k].unit})`}>
            <Input type="number" min={0} step="any" inputMode="decimal" value={values[k] ?? ""} onChange={(e) => { setValues({ ...values, [k]: e.target.value }); setSource("manual"); }} />
          </Field>
        ))}
      </div>
      <Button
        size="sm"
        pending={pending}
        onClick={() =>
          start(async () => {
            const nutrients = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]).filter(([, v]) => Number.isFinite(v as number) && (v as number) > 0));
            const r = await saveSupplementNutrients(id, ownerId, { nutrients, serving_label: serving.trim() || null, source });
            toast(r.error ?? t("Saved. Counted on days you tick it."), { tone: r.error ? "error" : "ok" });
          })
        }
      >
        {t("Save nutrients")}
      </Button>
    </div>
  );
}
