"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, Input, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { addDays } from "@/lib/dates";
import { PRIVATE_KINDS, PRIVATE_META, type PrivateKind } from "@/modules/private-log/meta";
import { addPrivateEntry, deletePrivateEntry, setAlcoholForAi } from "./actions";

const chip = (on: boolean) => cx("rounded-full px-3 py-1.5 text-sm", on ? "bg-accent font-medium text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg");

/**
 * Log something private in two taps: pick what, then (for drinks or
 * smoking) the kind and how many. Kinds with nothing to choose log at once.
 */
export function QuickLog({ today }: { today: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<PrivateKind | null>(null);
  const [date, setDate] = useState(today);
  const [detail, setDetail] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");
  const meta = kind ? PRIVATE_META[kind] : null;
  const perServing = kind === "alcohol" ? (PRIVATE_META.alcohol.details.find((d) => d.key === detail)?.drinks ?? 1) : 1;
  const amount = meta?.amount ? Math.round(count * perServing * 10) / 10 : null;

  function save(k: PrivateKind, d: string | null, a: number | null) {
    start(async () => {
      const r = await addPrivateEntry({ kind: k, detail: d, amount: a, occurred_on: date, notes });
      if (r.error) return toast(r.error, { tone: "error" });
      const label = PRIVATE_META[k].label;
      toast(`${label} logged${date === today ? "" : date === addDays(today, -1) ? " for yesterday" : ` for ${date}`}`, {
        kind: "save",
        detail: k === "alcohol" && a ? `${a} standard drink${a === 1 ? "" : "s"}` : null,
        undo: r.id ? () => deletePrivateEntry(r.id!) : undefined,
      });
      setKind(null);
      setDetail(null);
      setCount(1);
      setOther("");
      setNotes("");
    });
  }

  function pick(k: PrivateKind) {
    const m = PRIVATE_META[k];
    if (!m.details.length && !m.amount && k !== "other") return save(k, null, null);
    setKind(kind === k ? null : k);
    setDetail(m.details[0]?.key ?? null);
    setCount(1);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
        When:
        <button type="button" className={chip(date === today)} onClick={() => setDate(today)}>Today</button>
        <button type="button" className={chip(date === addDays(today, -1))} onClick={() => setDate(addDays(today, -1))}>Yesterday</button>
        <Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="!h-8 w-36" aria-label="Date" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PRIVATE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={pending}
            onClick={() => pick(k)}
            aria-pressed={kind === k}
            className={cx("pressable flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-sm", kind === k ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2")}
          >
            <span aria-hidden className="text-2xl">{PRIVATE_META[k].icon}</span>
            {PRIVATE_META[k].label}
          </button>
        ))}
      </div>
      {kind && meta ? (
        <div className="space-y-3 rounded-2xl bg-surface-2/50 p-3 [animation:toast-in_.2s_ease-out]">
          {meta.details.length ? (
            <div className="flex flex-wrap gap-1.5">
              {meta.details.map((d) => (
                <button key={d.key} type="button" className={chip(detail === d.key)} onClick={() => setDetail(detail === d.key && !meta.amount ? null : d.key)}>
                  {d.label}
                </button>
              ))}
            </div>
          ) : null}
          {kind === "other" ? <Input value={other} onChange={(e) => setOther(e.target.value)} maxLength={40} placeholder="What? e.g. edible, nicotine pouch" aria-label="What" autoFocus /> : null}
          {meta.amount ? (
            <div className="flex items-center gap-2 text-sm">
              <button type="button" className="grid size-8 place-items-center rounded-lg bg-surface" aria-label="One less" onClick={() => setCount(Math.max(1, count - 1))}><Minus className="size-4" aria-hidden /></button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums">{count}</span>
              <button type="button" className="grid size-8 place-items-center rounded-lg bg-surface" aria-label="One more" onClick={() => setCount(Math.min(30, count + 1))}><Plus className="size-4" aria-hidden /></button>
              {kind === "alcohol" ? <span className="text-fg-muted">= {amount} standard drink{amount === 1 ? "" : "s"}</span> : null}
            </div>
          ) : null}
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Note (optional)" aria-label="Note" />
          <div className="flex gap-2">
            <Button size="sm" pending={pending} disabled={kind === "other" && !other.trim()} onClick={() => save(kind, kind === "other" ? other.trim() : detail, amount)}>
              Log {meta.label.toLowerCase()}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setKind(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DeleteEntry({ id }: { id: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="rounded p-1 text-fg-muted hover:text-danger"
      aria-label="Delete entry"
      onClick={() => start(async () => {
        const r = await deletePrivateEntry(id);
        toast(r.error ?? "Deleted.", r.error ? { tone: "error" } : { kind: "delete" });
      })}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

export function AlcoholAiToggle({ on }: { on: boolean }) {
  const { toast } = useToast();
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-[var(--accent)]"
        checked={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setValue(next);
          start(async () => {
            const r = await setAlcoholForAi(next);
            if (r.error) setValue(!next);
            toast(r.error ?? r.message ?? "Saved.", r.error ? { tone: "error" } : { kind: "save" });
          });
        }}
      />
      <span>
        Let the AI coach count my drinks
        <span className="block text-xs text-fg-muted">Only drinks per week and alcohol-free days, to factor in calories, sleep and recovery. Nothing else from this log is ever sent.</span>
      </span>
    </label>
  );
}
