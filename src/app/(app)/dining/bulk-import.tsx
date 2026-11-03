"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoButtons } from "@/components/photo-buttons";
import { Badge, Button, Card, Input, Notice, Textarea, cx } from "@/components/ui";
import { MAX_UPLOAD_BYTES, compressImage } from "@/lib/compress-image";
import type { DiningImport } from "@/lib/ai/phase2-schemas";
import { PLATFORM_LABEL, placeKey } from "@/modules/dining/bulk";
import { importDiningBulk } from "./actions";

type Row = DiningImport["places"][number] & { keep: boolean };
const MAX_FILES = 10;

/**
 * Many restaurants at once from order history screenshots (Swiggy/Zomato →
 * Profile → Your orders), order emails, or a typed list. Review, then save
 * restaurants, the dishes you ordered and the past orders in one go.
 */
export function BulkImport({ savedNames, initialFiles, onDone, defaultOpen = false }: { savedNames: string[]; initialFiles?: File[]; onDone?: () => void; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen || Boolean(initialFiles?.length));
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [saving, start] = useTransition();
  const saved = new Set(savedNames.map(placeKey));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-2xl bg-accent-soft px-4 py-3 text-left text-sm hover:opacity-90">
        ✨ <strong>Add many at once</strong> from your Swiggy / Zomato order history, order emails, or a list of names
      </button>
    );
  }

  async function read() {
    setLoading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      if (text.trim()) fd.set("text", text.trim());
      let total = 0;
      for (const f of files.slice(0, MAX_FILES)) {
        const small = await compressImage(f);
        total += small.size;
        if (total > MAX_UPLOAD_BYTES) throw new Error("Those images are too large together. Try fewer screenshots at a time.");
        fd.append("photos", small);
      }
      const res = await fetch("/api/ai/dining-import", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({ error: res.status === 413 ? "Upload too large. Try fewer screenshots." : "Reading failed" }));
      if (!res.ok) throw new Error(body.error ?? "Reading failed");
      const places = (body as DiningImport).places;
      setRows(places.map((p) => ({ ...p, keep: true })));
      setNote(body.note);
      if (!places.length) setMsg({ tone: "danger", text: body.note || "No restaurants found. Try clearer screenshots of the orders list." });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!rows) return;
    start(async () => {
      const keep = rows.filter((r) => r.keep && r.name.trim()).map(({ keep: _k, ...r }) => (void _k, r));
      const res = await importDiningBulk(keep);
      setMsg(res.error ? { tone: "danger", text: res.error } : { tone: "accent", text: `${res.message} Open a restaurant → Import menu → Find menu online to add its full menu.` });
      if (!res.error) {
        setRows(null);
        setFiles([]);
        setText("");
        router.refresh();
        onDone?.();
      }
    });
  }

  const update = (i: number, patch: Partial<Row>) => setRows(rows!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const kept = rows?.filter((r) => r.keep) ?? [];

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">✨ Add many restaurants at once</p>
          <p className="text-xs text-fg-muted">AI reads them, with what you ordered and when. You review before anything is saved.</p>
        </div>
        {!initialFiles?.length ? <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>Close</button> : null}
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-fg-muted">
        <li><strong>Swiggy:</strong> Account → Orders. <strong>Zomato:</strong> Profile → Your orders. Scroll and take a few screenshots (up to {MAX_FILES}).</li>
        <li>Or paste order confirmation emails, or just type the places you like: &quot;Behrouz Biryani, Burger Singh, Vaishali (FC Road), Malaka Spice&quot;.</li>
        <li>On Android you can also share screenshots straight from the gallery to Hearth.</li>
      </ul>
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-center text-sm">
        <span className="text-2xl" aria-hidden>🧾</span>
        {files.length ? `${files.length} screenshot${files.length === 1 ? "" : "s"} selected (max ${MAX_FILES})` : "Screenshots of your orders or favourites"}
        <PhotoButtons multiple onFiles={(f) => setFiles([...files, ...f].slice(0, MAX_FILES))} cameraLabel="Take photo" uploadLabel="Upload screenshots" />
      </div>
      {files.length ? (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs">
              {f.name.slice(0, 24)}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
        </div>
      ) : null}
      <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={30000} className="min-h-16" placeholder="…or paste order emails / type restaurant names" />
      <Button onClick={() => void read()} disabled={loading || (!files.length && !text.trim())}>{loading ? "Reading… (up to a minute)" : "✨ Find restaurants"}</Button>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {rows?.length ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {kept.length} of {rows.length} restaurants · {kept.reduce((a, r) => a + r.orders.length, 0)} orders
            </p>
            <div className="flex gap-2 text-xs">
              <button type="button" className="underline" onClick={() => setRows(rows.map((r) => ({ ...r, keep: true })))}>All</button>
              <button type="button" className="underline" onClick={() => setRows(rows.map((r) => ({ ...r, keep: false })))}>None</button>
            </div>
          </div>
          {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
          <ul className="max-h-[32rem] space-y-2 overflow-auto">
            {rows.map((r, i) => {
              const isSaved = saved.has(placeKey(r.name));
              const dishes = [...new Set(r.orders.flatMap((o) => o.items.map((x) => x.name)))];
              return (
                <li key={i} className={cx("rounded-xl border border-border p-2.5", !r.keep && "opacity-50")}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={r.keep} onChange={(e) => update(i, { keep: e.target.checked })} aria-label={`Keep ${r.name}`} />
                    <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="!h-8" aria-label="Restaurant name" />
                    <Badge tone={isSaved ? "neutral" : "accent"}>{isSaved ? "Saved" : "New"}</Badge>
                  </div>
                  <p className="mt-1 pl-6 text-xs text-fg-muted">
                    {[r.cuisine, r.area, r.platform ? PLATFORM_LABEL[r.platform] || null : null].filter(Boolean).join(" · ")}
                    {r.orders.length ? ` · ${r.orders.length} order${r.orders.length === 1 ? "" : "s"}` : ""}
                  </p>
                  {dishes.length ? (
                    <details className="pl-6">
                      <summary className="cursor-pointer text-xs text-accent">{dishes.length} dish{dishes.length === 1 ? "" : "es"} ordered</summary>
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {r.orders.map((o, j) => (
                          <li key={j}>
                            <span className="text-fg-muted">{o.date ?? "date?"}{o.total != null ? ` · ₹${o.total}` : ""}: </span>
                            {o.items.map((x) => `${x.quantity}× ${x.name}`).join(", ")}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-fg-muted">Saved restaurants are matched by name and only new dishes and orders are added. Dishes you ordered twice or more are marked as your go-to. Calories are AI estimates.</p>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !kept.length}>{saving ? "Saving…" : `Save ${kept.length} restaurant${kept.length === 1 ? "" : "s"}`}</Button>
            <Button variant="ghost" onClick={() => setRows(null)}>Discard</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
