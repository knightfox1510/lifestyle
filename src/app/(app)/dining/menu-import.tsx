"use client";

import { PhotoButtons } from "@/components/photo-buttons";
import { useEffect, useState, useTransition } from "react";
import { Button, Card, Input, Notice, Textarea, cx } from "@/components/ui";
import { MAX_UPLOAD_BYTES, compressImage } from "@/lib/compress-image";
import type { MenuItem } from "@/lib/ai/phase2-schemas";
import { importMenu } from "./actions";
import { dishesFromCsv, menuToCsv, splitMenuText } from "@/modules/dining/csv";

type Row = MenuItem & { keep: boolean };
const CITY_KEY = "hearth.dining.city";
/** Parts of a long menu read at the same time. */
const PARALLEL = 3;

const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function mergeItems(lists: MenuItem[][]) {
  const seen = new Set<string>();
  return lists.flat().filter((i) => {
    const k = key(i.name);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Screenshot / photo / pasted-text → AI → reviewable dish list → saved menu. */
export function MenuImport({ placeId, placeName, initialFiles, initialText, onDone }: { placeId: string; placeName: string; initialFiles?: File[]; initialText?: string; onDone?: () => void }) {
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [text, setText] = useState(initialText ?? "");
  const [showText, setShowText] = useState(Boolean(initialText));
  const [progress, setProgress] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [saving, start] = useTransition();
  const [city, setCity] = useState("");
  const [searching, setSearching] = useState(false);

  // The city is remembered on this device, for finding menus online.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setCity(localStorage.getItem(CITY_KEY) ?? "");
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  function show(body: { items: MenuItem[]; note: string | null }, empty: string) {
    setRows(body.items.map((i) => ({ ...i, keep: true })));
    setNote(body.note);
    if (!body.items.length) setMsg({ tone: "danger", text: body.note || empty });
  }

  async function findOnline() {
    setSearching(true);
    setMsg(null);
    try {
      try {
        localStorage.setItem(CITY_KEY, city.trim());
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/ai/menu-online", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId, city: city.trim() || undefined }) });
      const body = await res.json().catch(() => ({ error: "Search failed" }));
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      show(body, "Couldn't find this menu online. Try screenshots instead.");
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setSearching(false);
    }
  }

  /** One AI call on pasted text (one part of a long menu). */
  async function readText(part: string): Promise<{ items: MenuItem[]; note: string | null }> {
    const fd = new FormData();
    fd.set("placeId", placeId);
    fd.set("text", part);
    const res = await fetch("/api/ai/menu-import", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({ error: "Reading failed" }));
    if (!res.ok) throw new Error(body.error ?? "Reading failed");
    return body;
  }

  /** A long menu is read in parts (a few at a time), so the AI doesn't stop after the first few dozen dishes. */
  async function readLongText(all: string) {
    const parts = splitMenuText(all);
    const results: { items: MenuItem[]; note: string | null }[] = new Array(parts.length);
    let done = 0;
    let failed = 0;
    setProgress(parts.length > 1 ? `Reading part 1 of ${parts.length}…` : null);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, parts.length) }, async () => {
        while (next < parts.length) {
          const i = next++;
          try {
            results[i] = await readText(parts[i]);
          } catch (e) {
            failed += 1;
            if (parts.length === 1) throw e;
            results[i] = { items: [], note: null };
          }
          done += 1;
          if (parts.length > 1) setProgress(`Read ${done} of ${parts.length} parts…`);
        }
      }),
    );
    const notes = results.map((r) => r.note).filter(Boolean);
    return { items: mergeItems(results.map((r) => r.items)), note: [failed ? `${failed} of ${parts.length} parts couldn't be read; try again for the rest.` : null, ...new Set(notes)].filter(Boolean).join(" ").slice(0, 600) || null };
  }

  async function read() {
    setLoading(true);
    setMsg(null);
    try {
      if (!files.length) {
        show(await readLongText(text.trim()), "No dishes found in that text.");
        return;
      }
      const fd = new FormData();
      fd.set("placeId", placeId);
      if (text.trim()) fd.set("text", text.trim().slice(0, 20000));
      let total = 0;
      for (const f of files.slice(0, 6)) {
        const small = await compressImage(f);
        total += small.size;
        if (total > MAX_UPLOAD_BYTES) throw new Error("Those images are too large together. Try fewer screenshots at a time.");
        fd.append("photos", small);
      }
      const res = await fetch("/api/ai/menu-import", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({ error: res.status === 413 ? "Upload too large. Try fewer screenshots." : "Reading failed" }));
      if (!res.ok) throw new Error(body.error ?? "Reading failed");
      show(body, "No dishes found. Try clearer or closer screenshots.");
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  /** A CSV menu: dishes come straight from the file; AI only estimates nutrition that's missing. */
  async function readCsv(file: File) {
    setLoading(true);
    setMsg(null);
    try {
      const dishes = dishesFromCsv(await file.text());
      if (!dishes.length) throw new Error("No dishes in that CSV.");
      const missing = dishes.filter((d) => d.calories == null);
      let estimates = new Map<string, MenuItem>();
      if (missing.length) {
        const lines = missing.map((d) => [d.section, d.name, d.price != null ? `₹${d.price}` : null, d.veg == null ? null : d.veg ? "veg" : "non-veg", d.serves > 1 ? `serves ${d.serves}` : null, d.description].filter(Boolean).join(" | "));
        const r = await readLongText(`Every line is one dish (section | dish | price | veg | details). Keep each dish name exactly as written.\n${lines.join("\n")}`);
        estimates = new Map(r.items.map((i) => [key(i.name), i]));
      }
      const items: MenuItem[] = dishes.map((d) => {
        const e = estimates.get(key(d.name));
        return {
          name: d.name,
          section: d.section ?? e?.section ?? null,
          description: d.description,
          price: d.price ?? e?.price ?? null,
          veg: d.veg ?? e?.veg ?? null,
          serves: d.serves,
          calories: Math.round(d.calories ?? e?.calories ?? 0),
          protein_g: d.protein_g ?? e?.protein_g ?? 0,
          carbs_g: d.carbs_g ?? e?.carbs_g ?? 0,
          fat_g: d.fat_g ?? e?.fat_g ?? 0,
        };
      });
      const noKcal = items.filter((i) => !i.calories).length;
      show({ items, note: [missing.length ? `Nutrition estimated by AI for ${missing.length - noKcal} dishes.` : null, noKcal ? `${noKcal} have no calories yet: fill them in or save and edit later.` : null].filter(Boolean).join(" ") || null }, "No dishes in that CSV.");
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  function downloadCsv() {
    if (!rows) return;
    const url = URL.createObjectURL(new Blob([menuToCsv(rows.filter((r) => r.keep))], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${placeName.replace(/[^\w\s-]+/g, "").trim() || "menu"} menu.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function save() {
    if (!rows) return;
    start(async () => {
      const keep = rows.filter((r) => r.keep).map(({ keep: _k, ...r }) => (void _k, r));
      const res = await importMenu(placeId, keep);
      setMsg(res.error ? { tone: "danger", text: res.error } : { tone: "accent", text: res.message ?? "Saved." });
      if (!res.error) {
        setRows(null);
        setFiles([]);
        setText("");
        onDone?.();
      }
    });
  }

  const update = (i: number, patch: Partial<Row>) => setRows(rows!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const num = (v: string) => (v === "" ? null : Math.max(0, Number(v)));

  return (
    <Card className="space-y-3 !bg-surface-2/50">
      <div>
        <p className="font-medium">Import {placeName}&apos;s menu</p>
        <p className="text-xs text-fg-muted">
          Screenshot the restaurant&apos;s page in Zomato or Swiggy (scroll and take a few), or photograph a paper menu. AI reads the dishes and prices and estimates calories. You review before saving.
        </p>
      </div>
      <div className="space-y-2 rounded-xl bg-surface p-3">
        <p className="text-sm font-medium">🔎 Easiest: find it online</p>
        <p className="text-xs text-fg-muted">AI searches Swiggy, Zomato and the restaurant&apos;s site for its menu. Works best for chains and places listed on delivery apps. Takes about a minute.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="City (e.g. Pune)" aria-label="City" className="!h-9 w-40" />
          <Button size="sm" onClick={() => void findOnline()} disabled={searching || loading}>{searching ? "Searching…" : "Find menu online"}</Button>
          <span className="text-xs text-fg-muted">uses web search</span>
        </div>
      </div>
      <p className="text-center text-xs text-fg-muted">or from screenshots</p>
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-center text-sm">
        <span className="text-2xl" aria-hidden>📸</span>
        {files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected (max 6)` : "Screenshots or photos of the menu"}
        <PhotoButtons multiple onFiles={(f) => setFiles([...files, ...f].slice(0, 6))} cameraLabel="Photograph menu" uploadLabel="Upload screenshots" />
      </div>
      {files.length ? (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs">
              {f.name.slice(0, 24)}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
        </div>
      ) : null}
      {showText ? (
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300000} className="min-h-24" placeholder="Paste menu text (from a website, PDF or the “Copy menu to Hearth” button)… Long menus are read in parts." />
      ) : (
        <button type="button" className="text-xs text-fg-muted underline" onClick={() => setShowText(true)}>or paste menu text instead</button>
      )}
      <label className="block cursor-pointer text-xs text-fg-muted underline">
        or upload a CSV (columns like Dish, Price, Section, Veg, Calories)
        <input type="file" accept=".csv,text/csv" className="sr-only" disabled={loading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void readCsv(f); }} />
      </label>
      <Button onClick={read} disabled={loading || searching || (!files.length && !text.trim())}>
        {loading ? progress ?? "Reading the menu…" : "✨ Read menu"}
      </Button>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {rows?.length ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{rows.filter((r) => r.keep).length} of {rows.length} dishes selected</p>
            <div className="flex gap-2 text-xs">
              <button type="button" className="underline" onClick={() => setRows(rows.map((r) => ({ ...r, keep: true })))}>All</button>
              <button type="button" className="underline" onClick={() => setRows(rows.map((r) => ({ ...r, keep: false })))}>None</button>
            </div>
          </div>
          {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
          <div className="max-h-[28rem] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-surface text-xs text-fg-muted">
                <tr><th /><th className="text-left font-medium">Dish</th><th className="font-medium">₹</th><th className="font-medium">kcal</th><th className="font-medium">Protein</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={cx("border-t border-border", !r.keep && "opacity-50")}>
                    <td className="px-1"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={r.keep} onChange={(e) => update(i, { keep: e.target.checked })} aria-label={`Keep ${r.name}`} /></td>
                    <td className="py-1 pr-2">
                      <div className="flex items-center gap-1">
                        <button type="button" title="Veg / non-veg" onClick={() => update(i, { veg: r.veg === true ? false : r.veg === false ? null : true })} className="text-xs">
                          {r.veg === true ? "🟢" : r.veg === false ? "🔴" : "⚪"}
                        </button>
                        <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="!h-8" aria-label="Dish name" />
                      </div>
                      {r.section ? <span className="text-[11px] text-fg-muted">{r.section}{r.serves > 1 ? ` · serves ${r.serves} (per person shown)` : ""}</span> : null}
                    </td>
                    <td className="px-0.5"><Input type="number" min={0} value={r.price ?? ""} onChange={(e) => update(i, { price: num(e.target.value) })} className="!h-8 w-20 text-right" aria-label="Price" /></td>
                    <td className="px-0.5"><Input type="number" min={0} value={r.calories} onChange={(e) => update(i, { calories: num(e.target.value) ?? 0 })} className="!h-8 w-20 text-right" aria-label="Calories" /></td>
                    <td className="px-0.5"><Input type="number" min={0} value={r.protein_g} onChange={(e) => update(i, { protein_g: num(e.target.value) ?? 0 })} className="!h-8 w-16 text-right" aria-label="Protein" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-fg-muted">Calories are AI estimates per person; adjust anything that looks off. Re-importing updates dishes that are already saved.</p>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !rows.some((r) => r.keep)}>{saving ? "Saving…" : "Save to menu"}</Button>
            <Button variant="secondary" onClick={downloadCsv}>Download CSV</Button>
            <Button variant="ghost" onClick={() => setRows(null)}>Discard</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
