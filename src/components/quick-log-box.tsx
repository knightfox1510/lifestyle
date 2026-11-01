"use client";

import { useState, useTransition } from "react";
import { Button, Notice, Textarea } from "@/components/ui";
import { VoiceButton } from "@/components/voice-input";
import type { QuickLog } from "@/lib/ai/phase2-schemas";
import { AMOUNT_LABEL, DRINK_META, KIND_META, TRIGGER_LABEL } from "@/modules/bladder/meta";
import { MEAL_META } from "@/modules/food/meta";
import { saveQuickLog } from "@/app/(app)/log/actions";

/** "HH:MM" today in the browser's timezone → ISO; null → now. Future times are taken as yesterday. */
function toIso(time: string | null) {
  const d = new Date();
  if (!time) return d.toISOString();
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  if (d.getTime() > Date.now() + 5 * 60_000) d.setDate(d.getDate() - 1);
  return d.toISOString();
}

export function QuickLogBox({ ownerId, compact = false }: { ownerId: string; compact?: boolean }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<QuickLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [saving, start] = useTransition();

  async function parse(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, localTime: new Date().toTimeString().slice(0, 5) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't understand that");
      setResult(body);
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!result) return;
    start(async () => {
      const res = await saveQuickLog(ownerId, {
        food: result.food.map(({ time, ...f }) => ({ ...f, at: toIso(time) })),
        drinks: result.drinks.map(({ time, ...d }) => ({ ...d, at: toIso(time) })),
        bladder: result.bladder.map(({ time, ...b }) => ({ ...b, at: toIso(time) })),
        weight_kg: result.weight_kg,
      });
      setMsg(res.error ? { tone: "danger", text: res.error } : { tone: "accent", text: res.message ?? "Logged." });
      if (!res.error) {
        setResult(null);
        setText("");
      }
    });
  }

  const empty = result && !result.food.length && !result.drinks.length && !result.bladder.length && result.weight_kg === null;

  return (
    <div className="space-y-3">
      <form onSubmit={parse} className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          className={compact ? "min-h-10 flex-1" : "min-h-16 flex-1"}
          placeholder="e.g. “2 coffees, poha for breakfast, small leak during squats at 7:40, weighed 63.8”"
          aria-label="What to log"
        />
        <div className="flex flex-col gap-2">
          <VoiceButton onText={(t) => setText((p) => (p ? `${p} ${t}` : t))} />
          <Button type="submit" size="sm" disabled={loading || !text.trim()} aria-label="Read note">{loading ? "…" : "✨"}</Button>
        </div>
      </form>
      {result ? (
        <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
          {empty ? <p className="text-fg-muted">Nothing to log was recognised.</p> : <p className="font-medium">I&apos;ll log:</p>}
          <ul className="space-y-1">
            {result.food.map((f, i) => (
              <li key={`f${i}`}>{MEAL_META[f.meal].icon} {f.description} · {f.calories} kcal{f.time ? ` · ${f.time}` : ""}</li>
            ))}
            {result.drinks.map((d, i) => (
              <li key={`d${i}`}>{DRINK_META[d.drink].icon} {DRINK_META[d.drink].label} {d.volume_ml} ml{d.time ? ` · ${d.time}` : ""}</li>
            ))}
            {result.bladder.map((b, i) => (
              <li key={`b${i}`}>
                {KIND_META[b.kind].icon} {KIND_META[b.kind].label}
                {b.amount ? ` (${AMOUNT_LABEL[b.amount].toLowerCase()})` : ""}
                {b.triggers.length ? ` · ${b.triggers.map((t) => TRIGGER_LABEL[t]).join(", ")}` : ""}
                {b.time ? ` · ${b.time}` : ""}
              </li>
            ))}
            {result.weight_kg !== null ? <li>⚖️ Weight {result.weight_kg} kg</li> : null}
          </ul>
          {result.unrecognised ? <p className="text-xs text-fg-muted">Not logged: {result.unrecognised}</p> : null}
          <div className="flex gap-2">
            {!empty ? <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Log it"}</Button> : null}
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </div>
  );
}
