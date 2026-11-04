"use client";

import { useState, useTransition, type ReactNode } from "react";
import { SwipeRow } from "@/components/swipe-row";
import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { BLADDER_KINDS, BLADDER_TRIGGERS, DRINKS, LEAK_AMOUNTS, type BladderEvent, type FluidIntake } from "@/lib/types";
import { AMOUNT_LABEL, DRINK_META, KIND_META, TRIGGER_LABEL } from "@/modules/bladder/meta";
import { deleteBladderEvent, deleteFluid, updateBladderEvent, updateFluid } from "./actions";

const chip = (on: boolean) => cx("rounded-full border px-3 py-1 text-xs", on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted");

/** Quick nudges for the time: most fixes are "that was 15 minutes earlier". */
function shift(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function WhenFields({ date, time, setDate, setTime, today }: { date: string; time: string; setDate: (v: string) => void; setTime: (v: string) => void; today: string }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Time">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[-60, -30, -15, 15, 30, 60].map((m) => (
          <button key={m} type="button" onClick={() => setTime(shift(time, m))} className="rounded-full border border-border px-2.5 py-1 text-xs tabular-nums text-fg-muted hover:border-accent hover:text-accent">
            {m > 0 ? "+" : "−"}
            {Math.abs(m) >= 60 ? `${Math.abs(m) / 60} h` : `${Math.abs(m)} min`}
          </button>
        ))}
      </div>
    </div>
  );
}

function Shell({ summary, open, setOpen, canEdit, children, onDelete }: { summary: ReactNode; open: boolean; setOpen: (v: boolean) => void; canEdit: boolean; children: ReactNode; onDelete?: () => void }) {
  return (
    <SwipeRow className="text-sm" right={canEdit ? { label: "Edit", icon: <Pencil className="size-4" aria-hidden />, onAction: () => setOpen(true) } : undefined} left={onDelete ? { label: "Delete", onAction: onDelete } : undefined}>
    <div className="bg-surface py-2.5">
      <div className="flex items-start justify-between gap-2">
        <button type="button" disabled={!canEdit} onClick={() => setOpen(!open)} aria-expanded={open} className={cx("min-w-0 flex-1 text-left", canEdit && "rounded-lg hover:bg-surface-2/60")}>
          {summary}
        </button>
        {canEdit ? (
          <button type="button" onClick={() => setOpen(!open)} className="rounded p-1 text-fg-muted hover:text-fg" aria-label="Edit entry">
            <Pencil className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {open ? <div className="mt-2 space-y-3 rounded-xl border border-border bg-surface-2/40 p-3">{children}</div> : null}
    </div>
    </SwipeRow>
  );
}

function Footer({ pending, onSave, onCancel, canDelete, onDelete }: { pending: boolean; onSave: () => void; onCancel: () => void; canDelete: boolean; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onSave} disabled={pending}>{pending ? "…" : "Save"}</Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      {canDelete ? (
        confirm ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
            Delete this entry?
            <Button size="sm" variant="danger" disabled={pending} onClick={onDelete}>Yes, delete</Button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="ml-auto inline-flex items-center gap-1 text-xs text-danger">
            <Trash2 className="size-3.5" aria-hidden /> Delete
          </button>
        )
      ) : null}
    </div>
  );
}

type Common = { ownerId: string; date: string; time: string; today: string; canEdit: boolean; canDelete: boolean };

export function BladderEventRow({ e, ownerId, date: d0, time: t0, today, canEdit, canDelete }: Common & { e: BladderEvent }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(d0);
  const [time, setTime] = useState(t0);
  const [kind, setKind] = useState(e.kind);
  const [amount, setAmount] = useState(e.amount ?? "small");
  const [urgency, setUrgency] = useState<number | null>(e.urgency ?? null);
  const [triggers, setTriggers] = useState<string[]>(e.triggers);
  const [pad, setPad] = useState(e.pad_changed);
  const [notes, setNotes] = useState(e.notes ?? "");
  const [pending, start] = useTransition();
  const reset = () => { setDate(d0); setTime(t0); setKind(e.kind); setAmount(e.amount ?? "small"); setUrgency(e.urgency ?? null); setTriggers(e.triggers); setPad(e.pad_changed); setNotes(e.notes ?? ""); };

  const summary = (
    <>
      <p>
        <span className="mr-2 font-mono text-fg-muted">{t0}</span>
        {KIND_META[e.kind].icon} <strong>{KIND_META[e.kind].label}</strong>
        {e.amount ? ` · ${AMOUNT_LABEL[e.amount]}` : ""}
        {e.urgency ? ` · urgency ${e.urgency}/5` : ""}
      </p>
      {e.triggers.length || e.pad_changed ? (
        <span className="mt-1 flex flex-wrap gap-1">
          {e.triggers.map((t) => <Badge key={t}>{TRIGGER_LABEL[t]}</Badge>)}
          {e.pad_changed ? <Badge tone="warn">pad changed</Badge> : null}
        </span>
      ) : null}
      {e.notes ? <span className="mt-1 block text-fg-muted">{e.notes}</span> : null}
    </>
  );

  return (
    <Shell summary={summary} open={open} setOpen={(v) => { if (!v) reset(); setOpen(v); }} canEdit={canEdit} onDelete={canDelete ? () => start(async () => { const r = await deleteBladderEvent(e.id, ownerId); toast(r.error ?? "Deleted.", r.error ? { tone: "error" } : { kind: "delete" }); }) : undefined}>
      <WhenFields date={date} time={time} setDate={setDate} setTime={setTime} today={today} />
      <div className="flex flex-wrap gap-1.5">
        {BLADDER_KINDS.map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={chip(kind === k)}>
            {KIND_META[k].icon} {KIND_META[k].label}
          </button>
        ))}
      </div>
      {kind === "leak" ? (
        <div className="flex flex-wrap gap-1.5">
          {LEAK_AMOUNTS.map((a) => (
            <button key={a} type="button" onClick={() => setAmount(a)} aria-pressed={amount === a} className={chip(amount === a)}>{AMOUNT_LABEL[a]}</button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-fg-muted">Urgency</span>
        {[1, 2, 3, 4, 5].map((u) => (
          <button key={u} type="button" onClick={() => setUrgency(urgency === u ? null : u)} aria-pressed={urgency === u} className={chip(urgency === u)}>{u}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BLADDER_TRIGGERS.map((t) => {
          const on = triggers.includes(t);
          return (
            <button key={t} type="button" onClick={() => setTriggers(on ? triggers.filter((x) => x !== t) : [...triggers, t])} aria-pressed={on} className={chip(on)}>{TRIGGER_LABEL[t]}</button>
          );
        })}
        <button type="button" onClick={() => setPad(!pad)} aria-pressed={pad} className={chip(pad)}>Pad changed</button>
      </div>
      <Textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} maxLength={1000} placeholder="Notes" className="min-h-12" />
      <Footer
        pending={pending}
        canDelete={canDelete}
        onCancel={() => { reset(); setOpen(false); }}
        onSave={() =>
          start(async () => {
            const r = await updateBladderEvent(e.id, ownerId, { date, time, kind, amount: kind === "leak" ? amount : null, urgency, triggers, pad_changed: pad, notes: notes || null });
            if (r.error) toast(r.error, { tone: "error" });
            else { toast(date !== d0 ? "Saved and moved to that day." : "Saved."); setOpen(false); }
          })
        }
        onDelete={() => start(async () => { const r = await deleteBladderEvent(e.id, ownerId); toast(r.error ?? "Deleted.", r.error ? { tone: "error" } : undefined); })}
      />
    </Shell>
  );
}

export function FluidRow({ f, ownerId, date: d0, time: t0, today, canEdit, canDelete }: Common & { f: FluidIntake }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(d0);
  const [time, setTime] = useState(t0);
  const [drink, setDrink] = useState(f.drink);
  const [volume, setVolume] = useState(String(f.volume_ml));
  const [caffeinated, setCaffeinated] = useState(f.caffeinated);
  const [pending, start] = useTransition();
  const reset = () => { setDate(d0); setTime(t0); setDrink(f.drink); setVolume(String(f.volume_ml)); setCaffeinated(f.caffeinated); };

  const summary = (
    <p>
      <span className="mr-2 font-mono text-fg-muted">{t0}</span>
      {DRINK_META[f.drink].icon} {DRINK_META[f.drink].label} · {f.volume_ml} ml
      {f.caffeinated ? <span className="text-fg-muted"> · caffeine</span> : null}
    </p>
  );

  return (
    <Shell summary={summary} open={open} setOpen={(v) => { if (!v) reset(); setOpen(v); }} canEdit={canEdit} onDelete={canDelete ? () => start(async () => { const r = await deleteFluid(f.id, ownerId); toast(r.error ?? "Deleted.", r.error ? { tone: "error" } : { kind: "delete" }); }) : undefined}>
      <WhenFields date={date} time={time} setDate={setDate} setTime={setTime} today={today} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Drink">
          <Select value={drink} onChange={(ev) => { const d = ev.target.value as FluidIntake["drink"]; setDrink(d); setCaffeinated(DRINK_META[d].caffeinated); }}>
            {DRINKS.map((d) => <option key={d} value={d}>{DRINK_META[d].icon} {DRINK_META[d].label}</option>)}
          </Select>
        </Field>
        <Field label="Amount (ml)">
          <Input type="number" min={10} max={3000} step={10} value={volume} onChange={(ev) => setVolume(ev.target.value)} />
        </Field>
      </div>
      <button type="button" onClick={() => setCaffeinated(!caffeinated)} aria-pressed={caffeinated} className={chip(caffeinated)}>Caffeinated</button>
      <Footer
        pending={pending}
        canDelete={canDelete}
        onCancel={() => { reset(); setOpen(false); }}
        onSave={() =>
          start(async () => {
            const r = await updateFluid(f.id, ownerId, { date, time, drink, volume_ml: Math.round(Number(volume) || 0), caffeinated });
            if (r.error) toast(r.error, { tone: "error" });
            else { toast(date !== d0 ? "Saved and moved to that day." : "Saved."); setOpen(false); }
          })
        }
        onDelete={() => start(async () => { const r = await deleteFluid(f.id, ownerId); toast(r.error ?? "Deleted.", r.error ? { tone: "error" } : undefined); })}
      />
    </Shell>
  );
}
