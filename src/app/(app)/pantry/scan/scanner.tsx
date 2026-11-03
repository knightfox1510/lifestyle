"use client";

import { PhotoButtons } from "@/components/photo-buttons";
import { useState, useTransition } from "react";
import { Button, Card, Input, Notice, Select, cx } from "@/components/ui";
import type { ScanItem } from "@/lib/ai/phase2-schemas";
import { compressImage } from "@/lib/compress-image";
import { addScannedToPantry } from "../actions";
import { addToGroceryList } from "@/app/(app)/recipes/actions";

type Mode = "receipt" | "shelf" | "list";
const MODES: { mode: Mode; label: string; hint: string; dest: "pantry" | "grocery" }[] = [
  { mode: "receipt", label: "🧾 Receipt", hint: "Bought groceries? Snap the bill or the order screen.", dest: "pantry" },
  { mode: "shelf", label: "🧊 Fridge or shelf", hint: "Photograph a fridge shelf or cupboard to record what's there.", dest: "pantry" },
  { mode: "list", label: "📝 List or empty pack", hint: "A handwritten list or an empty packet becomes grocery-list items.", dest: "grocery" },
];

export function Scanner({ pantryOn, groceriesOn }: { pantryOn: boolean; groceriesOn: boolean }) {
  const [mode, setMode] = useState<Mode>(pantryOn ? "receipt" : "list");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<(ScanItem & { keep: boolean })[] | null>(null);
  const [dest, setDest] = useState<"pantry" | "grocery">(pantryOn ? "pantry" : "grocery");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [saving, start] = useTransition();

  function pick(f: File | null) {
    setFile(f);
    setItems(null);
    setMsg(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function scan() {
    if (!file) return;
    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("photo", await compressImage(file));
    try {
      const res = await fetch("/api/ai/scan", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Scan failed");
      setItems(body.items.map((i: ScanItem) => ({ ...i, keep: true })));
      setDest(MODES.find((m) => m.mode === mode)!.dest === "pantry" && pantryOn ? "pantry" : "grocery");
      if (body.note) setMsg({ tone: "accent", text: body.note });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!items) return;
    const keep = items.filter((i) => i.keep).map((i) => ({ name: i.name, quantity: i.quantity, category: i.category, location: i.location, expires_in_days: i.expires_in_days, expiry_printed: i.expiry_printed }));
    start(async () => {
      const res = dest === "pantry" ? await addScannedToPantry(keep, mode === "receipt") : await addToGroceryList(keep.map((k) => ({ name: k.name, quantity: k.quantity, category: k.category })));
      if (res.error) setMsg({ tone: "danger", text: res.error });
      else {
        setMsg({ tone: "accent", text: res.message ?? "Saved." });
        setItems(null);
        pick(null);
      }
    });
  }

  const update = (i: number, patch: Partial<ScanItem & { keep: boolean }>) => setItems(items!.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {MODES.filter((m) => (m.dest === "pantry" ? pantryOn : groceriesOn)).map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => setMode(m.mode)}
              className={cx("rounded-xl border px-2 py-2.5 text-sm font-medium", mode === m.mode ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2")}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-fg-muted">{MODES.find((m) => m.mode === mode)!.hint}</p>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-6 text-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected photo" className="max-h-64 rounded-lg object-contain" />
          ) : (
            <span className="text-4xl" aria-hidden>📷</span>
          )}
          <PhotoButtons onFiles={(f) => pick(f[0])} cameraLabel={preview ? "Retake" : "Take photo"} uploadLabel={preview ? "Choose another" : "Upload"} />
        </div>
        <Button onClick={scan} disabled={!file || loading} className="w-full sm:w-auto">
          {loading ? "Reading the photo…" : "✨ Read items"}
        </Button>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </Card>

      {items ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{items.length} items found. Fix anything wrong, then save.</p>
            {pantryOn && groceriesOn ? (
              <Select value={dest} onChange={(e) => setDest(e.target.value as "pantry" | "grocery")} className="w-48" aria-label="Save to">
                <option value="pantry">Save to pantry</option>
                <option value="grocery">Add to grocery list</option>
              </Select>
            ) : null}
          </div>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={it.keep} onChange={(e) => update(i, { keep: e.target.checked })} aria-label={`Keep ${it.name}`} />
                <Input value={it.name} onChange={(e) => update(i, { name: e.target.value })} className="!h-8 min-w-36 flex-[3]" aria-label="Name" />
                <Input value={it.quantity ?? ""} onChange={(e) => update(i, { quantity: e.target.value || null })} className="!h-8 w-20 flex-1" aria-label="Quantity" placeholder="qty" />
                {dest === "pantry" ? (
                  <>
                    <Select value={it.location} onChange={(e) => update(i, { location: e.target.value as ScanItem["location"] })} className="!h-8 w-28" aria-label="Location">
                      <option value="fridge">Fridge</option>
                      <option value="freezer">Freezer</option>
                      <option value="pantry">Cupboard</option>
                    </Select>
                    <label className="flex items-center gap-1 text-xs text-fg-muted">
                      <Input
                        type="number"
                        min={0}
                        max={1095}
                        value={it.expires_in_days ?? ""}
                        onChange={(e) => update(i, { expires_in_days: e.target.value === "" ? null : Number(e.target.value), expiry_printed: false })}
                        className="!h-8 w-16"
                        aria-label="Days until expiry"
                      />
                      days{it.expiry_printed ? " (printed)" : ""}
                    </label>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !items.some((i) => i.keep)}>
              {saving ? "Saving…" : dest === "pantry" ? `Save ${items.filter((i) => i.keep).length} to pantry` : `Add ${items.filter((i) => i.keep).length} to grocery list`}
            </Button>
            <Button variant="ghost" onClick={() => setItems(null)}>Discard</Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
