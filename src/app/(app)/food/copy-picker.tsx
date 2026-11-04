"use client";

import { useState, useTransition } from "react";
import { Bookmark, Copy, Trash2 } from "lucide-react";
import { Button, Input, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import type { Meal } from "@/lib/types";
import { copyEntries, deleteMealTemplate, logMealTemplate, saveMealTemplate, undoFoodEntries } from "./actions";

export type CopySource = {
  key: string;
  /** Logged foods (a partner's meal, yesterday's) or a saved meal. */
  kind: "entries" | "template";
  templateId?: string;
  label: string;
  /** Whose meal it is, for "your portion compared with Kari's". */
  who: string | null;
  /** Their user id: they already have it, so "Also for…" leaves them out. */
  fromId?: string;
  items: { id: string; description: string; quantity: string | null; calories: number | null }[];
};
export type Person = { id: string; name: string };

const PORTIONS: [number, string][] = [[0.5, "½×"], [0.75, "¾×"], [1, "1×"], [1.25, "1¼×"], [1.5, "1½×"], [2, "2×"]];

function PortionChips({ value, onChange }: { value: number; onChange: (f: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PORTIONS.map(([f, label]) => (
        <button key={f} type="button" onClick={() => onChange(f)} aria-pressed={value === f} className={cx("rounded-lg px-2.5 py-1 text-sm", value === f ? "bg-accent font-semibold text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg")}>
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * "Copy Kari's lunch", "Same as yesterday" or a saved meal: tick the items,
 * pick your portion, optionally add it for others too (each with their own
 * portion), and add in one tap with Undo.
 */
export function CopyPicker({ source, ownerId, people, meal, date, onDone }: { source: CopySource; ownerId: string; people: Person[]; meal: Meal; date: string; onDone?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(source.items.map((i) => i.id));
  const [factor, setFactor] = useState(1);
  // Others who can be added too (a shared dinner): off by default.
  const [also, setAlso] = useState<Record<string, number | null>>({});
  const [pending, start] = useTransition();
  const subtotal = source.items.filter((i) => picked.includes(i.id)).reduce((a, i) => a + Number(i.calories ?? 0), 0);
  const kcal = Math.round(subtotal * factor);
  const me = people.find((p) => p.id === ownerId);
  const others = people.filter((p) => p.id !== ownerId && p.id !== source.fromId);
  const whose = !me || me.name.endsWith(" (me)") ? "Your" : `${me.name}'s`;
  const targets = [{ ownerId, factor }, ...Object.entries(also).filter((e): e is [string, number] => e[1] != null).map(([id, f]) => ({ ownerId: id, factor: f }))];
  const Icon = source.kind === "template" ? Bookmark : Copy;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="pressable flex w-full items-center gap-2 rounded-xl border border-dashed border-accent/50 px-3 py-2 text-left text-sm hover:bg-accent-soft">
        <Icon className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <strong className="font-medium">{source.label}</strong>
          <span className="text-fg-muted">: {source.items.map((i) => i.description).join(", ")}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-fg-muted">{Math.round(subtotal)} kcal</span>
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-accent/40 bg-accent-soft/40 p-3 [animation:toast-in_.2s_ease-out]">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Icon className="size-4 text-accent" aria-hidden /> {source.label}</p>
        <div className="flex items-center gap-1">
          {source.kind === "template" && source.templateId ? (
            <button
              type="button"
              className="rounded p-1 text-fg-muted hover:text-danger"
              aria-label="Delete this saved meal"
              onClick={() =>
                confirm(`Delete the saved meal “${source.label}”?`) &&
                start(async () => {
                  const r = await deleteMealTemplate(source.templateId!);
                  toast(r.error ?? r.message ?? "Deleted.", r.error ? { tone: "error" } : undefined);
                })
              }
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : null}
          <button type="button" className="text-xs text-fg-muted" onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
      <ul className="space-y-1">
        {source.items.map((i) => (
          <li key={i.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={picked.includes(i.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))} />
              <span className="min-w-0 flex-1 truncate">{i.description}{i.quantity ? <span className="text-fg-muted"> · {i.quantity}</span> : null}</span>
              <span className="shrink-0 text-xs tabular-nums text-fg-muted">{i.calories != null ? `${Math.round(Number(i.calories) * factor)} kcal` : ""}</span>
            </label>
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-1 text-xs text-fg-muted">{source.who ? `${whose} portion compared with ${source.who}'s` : `${whose} portion`}</p>
        <PortionChips value={factor} onChange={setFactor} />
      </div>
      {others.length ? (
        <div className="space-y-1.5">
          {others.map((p) => (
            <div key={p.id} className="space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={also[p.id] != null} onChange={(e) => setAlso({ ...also, [p.id]: e.target.checked ? 1 : null })} />
                Also for {p.name}
                {also[p.id] != null ? <span className="text-xs tabular-nums text-fg-muted">· {Math.round(subtotal * also[p.id]!)} kcal</span> : null}
              </label>
              {also[p.id] != null ? <PortionChips value={also[p.id]!} onChange={(f) => setAlso({ ...also, [p.id]: f })} /> : null}
            </div>
          ))}
        </div>
      ) : null}
      <Button
        size="sm"
        pending={pending}
        disabled={!picked.length}
        onClick={() =>
          start(async () => {
            const r =
              source.kind === "template"
                ? await logMealTemplate({ templateId: source.templateId, items: picked.map(Number), targets, meal, toDate: date })
                : await copyEntries({ entryIds: picked, targets, meal, toDate: date });
            if (r.error) return toast(r.error, { tone: "error" });
            toast(r.message ?? "Added.", { kind: "food", undo: r.ids?.length ? () => undoFoodEntries(r.ids!) : undefined });
            setOpen(false);
            setAlso({});
            onDone?.();
          })
        }
      >
        Add {picked.length} item{picked.length === 1 ? "" : "s"} · {kcal.toLocaleString("en-IN")} kcal{targets.length > 1 ? ` + ${others.filter((p) => also[p.id] != null).map((p) => p.name).join(", ")}` : ""}
      </Button>
    </div>
  );
}

/** "Save this meal": keeps the meal's foods as a named meal for the household, for one-tap logging later. */
export function SaveMealButton({ entryIds, meal, suggestion }: { entryIds: string[]; meal: Meal; suggestion: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestion);
  const [pending, start] = useTransition();
  if (!entryIds.length) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent">
        <Bookmark className="size-3.5" aria-hidden /> Save this meal
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveMealTemplate({ entryIds, name, meal });
          if (r.error) return toast(r.error, { tone: "error" });
          toast(r.message ?? "Saved.", { kind: "save" });
          setOpen(false);
        });
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="!h-8 w-56" aria-label="Name for this meal" autoFocus />
      <Button size="sm" type="submit" pending={pending} disabled={!name.trim()}>Save</Button>
      <button type="button" className="text-xs text-fg-muted" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}
