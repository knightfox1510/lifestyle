"use client";

import { PhotoButtons } from "@/components/photo-buttons";
import { useState, useTransition } from "react";
import { Button, Card, Input, Notice, Textarea, cx } from "@/components/ui";
import { MAX_UPLOAD_BYTES, compressImage } from "@/lib/compress-image";
import type { MenuItem } from "@/lib/ai/phase2-schemas";
import { importMenu } from "./actions";

type Row = MenuItem & { keep: boolean };

/** Screenshot / photo / pasted-text → AI → reviewable dish list → saved menu. */
export function MenuImport({ placeId, placeName, initialFiles, onDone }: { placeId: string; placeName: string; initialFiles?: File[]; onDone?: () => void }) {
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [saving, start] = useTransition();

  async function read() {
    setLoading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("placeId", placeId);
      if (text.trim()) fd.set("text", text.trim());
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
      setRows((body.items as MenuItem[]).map((i) => ({ ...i, keep: true })));
      setNote(body.note);
      if (!body.items.length) setMsg({ tone: "danger", text: "No dishes found. Try clearer or closer screenshots." });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
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
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} className="min-h-24" placeholder="Paste menu text (from a website or PDF)…" />
      ) : (
        <button type="button" className="text-xs text-fg-muted underline" onClick={() => setShowText(true)}>or paste menu text instead</button>
      )}
      <Button onClick={read} disabled={loading || (!files.length && !text.trim())}>
        {loading ? "Reading the menu…" : "✨ Read menu"}
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
            <Button variant="ghost" onClick={() => setRows(null)}>Discard</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
