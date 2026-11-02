"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { CATEGORY_META, formatRange } from "@/modules/medical/meta";
import type { ExtractedEvent } from "@/lib/ai/schemas";
import type { LabResultInput } from "@/lib/ai/phase2-schemas";
import { refLabel, valueLabel } from "@/modules/medical/labs";
import { importExtractedEvents } from "../actions";

/** Runs Gemini on a document and lets the user pick which entries go on the timeline. */
export function AnalyzeDocument({ documentId, alreadyRead }: { documentId: string; alreadyRead: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ExtractedEvent[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [labs, setLabs] = useState<LabResultInput[]>([]);
  const [labSelected, setLabSelected] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ tone: "danger" | "accent"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  async function analyze() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ai/medical-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Analysis failed");
      setEvents(body.events);
      setSelected(new Set((body.events as ExtractedEvent[]).map((_, i) => i)));
      setLabs(body.lab_results ?? []);
      setLabSelected(new Set(((body.lab_results ?? []) as LabResultInput[]).map((_, i) => i)));
      router.refresh();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!events) return;
    startSaving(async () => {
      const res = await importExtractedEvents(
        documentId,
        events.filter((_, i) => selected.has(i)),
        labs.filter((_, i) => labSelected.has(i)),
      );
      if (res.error) setMessage({ tone: "danger", text: res.error });
      else {
        setMessage({ tone: "accent", text: res.message ?? "Added." });
        setEvents(null);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={analyze} disabled={loading}>
        {loading ? "Reading… long reports can take 1–2 minutes" : alreadyRead ? "✨ Read again with AI" : "✨ Read with AI"}
      </Button>
      {message ? <div className="basis-full"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
      {events ? (
        <div className="basis-full space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm font-medium">
            {events.length || labs.length ? "AI found these. Untick anything wrong, then add them." : "Nothing to add was found in this document."}
          </p>
          <ul className="space-y-1.5">
            {events.map((e, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--accent)]"
                    checked={selected.has(i)}
                    onChange={(ev) => {
                      const next = new Set(selected);
                      if (ev.target.checked) next.add(i);
                      else next.delete(i);
                      setSelected(next);
                    }}
                  />
                  <span>
                    {CATEGORY_META[e.category].icon} <strong>{e.title}</strong>
                    <span className="text-fg-muted"> · {formatRange(e.start_date, e.end_date, e.ongoing)}</span>
                    {e.dosage || e.frequency ? <span className="block text-xs">{[e.dosage, e.frequency].filter(Boolean).join(" · ")}</span> : null}
                    {e.details ? <span className="block text-xs text-fg-muted">{e.details}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {labs.length ? (
            <div className="space-y-1">
              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Lab values ({labs.length})</p>
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {labs.map((l, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--accent)]"
                        checked={labSelected.has(i)}
                        onChange={(ev) => {
                          const next = new Set(labSelected);
                          if (ev.target.checked) next.add(i);
                          else next.delete(i);
                          setLabSelected(next);
                        }}
                      />
                      <span>
                        <strong>{l.marker}</strong> {valueLabel(l)}
                        {l.flag && l.flag !== "normal" ? <span className="ml-1 font-medium text-danger">({l.flag})</span> : null}
                        <span className="block text-xs text-fg-muted">
                          {[l.panel, l.test_date, refLabel(l) && `ref ${refLabel(l)}`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex gap-2">
            {events.length || labs.length ? (
              <Button size="sm" onClick={save} disabled={saving || selected.size + labSelected.size === 0}>
                {saving ? "Adding…" : `Add ${selected.size + labSelected.size} selected`}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setEvents(null)}>Dismiss</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
