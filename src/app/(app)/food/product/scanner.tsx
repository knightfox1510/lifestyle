"use client";

import { PhotoButtons } from "@/components/photo-buttons";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, Input, Notice, cx } from "@/components/ui";
import type { PersonPortion } from "@/components/nutrition-ui";
import { compressImage } from "@/lib/compress-image";
import { MICRO_KEYS, NUTRIENT_META, formatNutrient, type Nutrients } from "@/modules/nutrition/nutrients";
import { IRRITANT_META, type Irritant } from "@/modules/nutrition/irritants";
import { FoodAmountLogger } from "../food-logger";
import { saveCustomFood } from "../actions";

type Product = { name: string; brand: string | null; per100: Nutrients; serving_g: number | null; serving_label: string | null; irritants: string[]; barcode: string | null; source: "openfoodfacts" | "label" | "manual"; savedId?: string };

type Detector = { detect: (src: CanvasImageSource | Blob | ImageBitmap) => Promise<{ rawValue: string }[]> };
const getDetector = (): Detector | null => {
  const w = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector };
  return w.BarcodeDetector ? new w.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }) : null;
};

export function ProductScanner({ me, people, recent = [] }: { me: string; people: PersonPortion[]; /** Products scanned before (saved with a barcode). */ recent?: { name: string; brand: string | null; barcode: string }[] }) {
  const [mode, setMode] = useState<"barcode" | "label">("barcode");
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [saving, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSupported(Boolean(getDetector())), 0);
    return () => {
      window.clearTimeout(t);
      stream.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  async function lookup(raw: string) {
    const c = raw.replace(/\D/g, "");
    if (c.length < 6) return setMsg({ tone: "danger", text: "Enter the number under the barcode." });
    setLoading(true);
    setMsg(null);
    setProduct(null);
    try {
      const res = await fetch(`/api/food/barcode?code=${c}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Lookup failed");
      if (body.found === "saved") {
        const f = body.food;
        setProduct({ name: f.name, brand: f.brand, per100: f.nutrients, serving_g: f.serving_g, serving_label: f.serving_label, irritants: f.irritants ?? [], barcode: c, source: f.source, savedId: f.id });
      } else if (body.found === "openfoodfacts") {
        setProduct({ ...body.product, barcode: c, source: "openfoodfacts" });
        if (body.product.per100?.calories === undefined) setMsg({ tone: "danger", text: "Found the product but not its nutrition. Take a photo of the label instead." });
      } else {
        setMsg({ tone: "danger", text: body.error ?? "Not in the database yet. Take a photo of the nutrition label instead." });
        setMode("label");
      }
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
    const det = getDetector();
    if (!det) return;
    setMsg(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setScanning(true);
      requestAnimationFrame(async () => {
        if (!video.current) return;
        video.current.srcObject = stream.current;
        await video.current.play();
        const tick = async () => {
          if (!stream.current || !video.current) return;
          try {
            const hits = await det.detect(video.current);
            if (hits[0]?.rawValue) {
              stopCamera();
              setCode(hits[0].rawValue);
              void lookup(hits[0].rawValue);
              return;
            }
          } catch {
            /* keep trying */
          }
          window.setTimeout(tick, 300);
        };
        void tick();
      });
    } catch {
      setMsg({ tone: "danger", text: "Couldn't open the camera. Type the barcode number instead." });
    }
  }
  /** Reads a barcode from a photo picked from the gallery or files. */
  async function barcodeFromPhoto(file: File) {
    const det = getDetector();
    if (!det) return;
    setMsg(null);
    try {
      const bitmap = await createImageBitmap(file);
      const hits = await det.detect(bitmap);
      bitmap.close();
      if (hits[0]?.rawValue) {
        setCode(hits[0].rawValue);
        void lookup(hits[0].rawValue);
      } else setMsg({ tone: "danger", text: "No barcode found in that photo. Try a closer, sharper one, or type the number." });
    } catch {
      setMsg({ tone: "danger", text: "Couldn't read that photo. Type the barcode number instead." });
    }
  }
  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setScanning(false);
  }

  async function readLabel(file: File) {
    setLoading(true);
    setMsg(null);
    setProduct(null);
    try {
      const fd = new FormData();
      fd.set("photo", await compressImage(file));
      const res = await fetch("/api/ai/food-label", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't read the label");
      const per100 = Object.fromEntries(Object.entries(body.per100 ?? {}).filter(([, v]) => typeof v === "number")) as Nutrients;
      setProduct({ name: body.name, brand: body.brand, per100, serving_g: body.serving_g, serving_label: body.serving_label, irritants: body.irritants ?? [], barcode: code.replace(/\D/g, "") || null, source: "label" });
      if (body.note) setMsg({ tone: "accent", text: body.note });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!product) return;
    start(async () => {
      const r = await saveCustomFood({
        id: product.savedId ?? null,
        name: product.name,
        brand: product.brand,
        barcode: product.barcode && /^\d{6,14}$/.test(product.barcode) ? product.barcode : null,
        source: product.source,
        serving_g: product.serving_g,
        serving_label: product.serving_label,
        nutrients: product.per100 as Record<string, number>,
        irritants: product.irritants,
      });
      if (r.id) setProduct({ ...product, savedId: r.id });
      setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Saved." });
    });
  }

  return (
    <div className="space-y-4">
      {recent.length && !product ? (
        <Card className="space-y-2">
          <p className="text-sm font-medium">Scanned before</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <button key={r.barcode} type="button" disabled={loading} onClick={() => { setCode(r.barcode); void lookup(r.barcode); }} className="pressable rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
                ▥ {r.name}{r.brand ? <span className="text-fg-muted"> · {r.brand}</span> : null}
              </button>
            ))}
          </div>
        </Card>
      ) : null}
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["barcode", "label"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); stopCamera(); }} className={cx("rounded-xl border py-2.5 text-sm font-medium", mode === m ? "border-accent bg-accent-soft text-accent" : "border-border")}>
              {m === "barcode" ? "▥ Barcode" : "📄 Nutrition label photo"}
            </button>
          ))}
        </div>

        {mode === "barcode" ? (
          <div className="space-y-2">
            {supported ? (
              scanning ? (
                <div className="space-y-2">
                  <video ref={video} className="w-full rounded-xl bg-black" playsInline muted />
                  <Button variant="ghost" size="sm" onClick={stopCamera}>Stop camera</Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={startCamera}>📷 Scan with camera</Button>
                  <PhotoButtons onFiles={(f) => void barcodeFromPhoto(f[0])} cameraLabel="Photo of barcode" uploadLabel="Barcode from gallery" />
                </div>
              )
            ) : supported === false ? (
              <p className="text-xs text-fg-muted">This browser can&apos;t scan barcodes (iPhone Safari can&apos;t). Type the number printed under the barcode, or use the label photo.</p>
            ) : null}
            <form onSubmit={(e) => { e.preventDefault(); void lookup(code); }} className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="Barcode number, e.g. 8901063…" aria-label="Barcode number" />
              <Button type="submit" variant="secondary" disabled={loading}>{loading ? "…" : "Look up"}</Button>
            </form>
            <p className="text-xs text-fg-muted">Looks in your saved foods first, then Open Food Facts (a free public database; Indian coverage is good but not complete).</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-5 text-center text-sm">
            <span className="text-2xl" aria-hidden>📄</span>
            {loading ? "Reading the label…" : "A clear photo of the nutrition table (and ingredients, if they fit)"}
            <PhotoButtons disabled={loading} onFiles={(f) => void readLabel(f[0])} />
          </div>
        )}
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </Card>

      {product ? (
        <Card className="space-y-3">
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-fg-muted">
              Per 100 g: {Math.round(product.per100.calories ?? 0)} kcal · P {product.per100.protein_g ?? "–"} · C {product.per100.carbs_g ?? "–"} · F {product.per100.fat_g ?? "–"} · fibre {product.per100.fiber_g ?? "–"}
              {product.serving_label || product.serving_g ? ` · serving ${product.serving_label ?? `${product.serving_g} g`}` : ""}
            </p>
            <p className="text-xs text-fg-muted">{MICRO_KEYS.filter((k) => product.per100[k] !== undefined).map((k) => `${NUTRIENT_META[k].label} ${formatNutrient(k, product.per100[k])}`).join(" · ")}</p>
            {product.irritants.length ? <p className="text-xs">Bladder irritants: {product.irritants.map((x) => `${IRRITANT_META[x as Irritant]?.icon ?? ""} ${IRRITANT_META[x as Irritant]?.label ?? x}`).join(", ")}</p> : null}
          </div>
          {product.savedId ? <p className="text-xs text-accent">✓ In your foods</p> : <Button size="sm" variant="secondary" onClick={save} disabled={saving}>Save to my foods</Button>}
          {product.per100.calories !== undefined ? (
            <FoodAmountLogger name={product.name} per100={product.per100} servingG={product.serving_g} servingLabel={product.serving_label} liquid={/\bml\b/i.test(product.serving_label ?? "")} irritants={product.irritants} accuracy="label" me={me} people={people} />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
