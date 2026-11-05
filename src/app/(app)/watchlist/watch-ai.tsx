"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button, Card, Input, Notice, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import type { WatchSuggestion } from "@/lib/ai/watch-schemas";
import { addWatchSuggestion } from "./actions";
import { InfoLine } from "./info-line";

const KINDS = [["", "Anything"], ["series", "Series"], ["movie", "Movie"], ["documentary", "Documentary"], ["anime", "Anime"]] as const;
const TIME = [[null, "Any length"], [45, "~45 min"], [120, "~2 h"], [300, "A binge"]] as const;
const chip = (on: boolean) => cx("rounded-full px-3 py-1 text-sm", on ? "bg-accent font-medium text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg");

/** "What should we watch?": picks from what you've both rated, finished and dropped, with IMDb ratings and where it streams in India. */
export function WatchSuggest() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState("");
  const [kind, setKind] = useState("");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [picks, setPicks] = useState<WatchSuggestion[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function ask() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/watch-suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mood: mood.trim() || undefined, kind: kind || undefined, minutes }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't get suggestions");
      setPicks(body.picks);
      setNote(body.note);
      setAdded([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="pressable flex w-full items-center gap-2 rounded-2xl border border-accent/40 bg-accent-soft/40 px-4 py-3 text-left text-sm hover:bg-accent-soft">
        <Sparkles className="size-4 text-accent" aria-hidden />
        <span><strong className="font-medium">What should we watch?</strong> <span className="text-fg-muted">Picks from what you&apos;ve both liked</span></span>
      </button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold"><Sparkles className="size-4 text-accent" aria-hidden /> What should we watch?</h2>
        <button type="button" className="text-xs text-fg-muted" onClick={() => setOpen(false)}>Close</button>
      </div>
      <Input value={mood} onChange={(e) => setMood(e.target.value)} maxLength={300} placeholder="Mood? e.g. light comedy, gripping thriller, something Malayalam, like Panchayat" aria-label="Mood" />
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(([k, l]) => <button key={k} type="button" className={chip(kind === k)} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TIME.map(([m, l]) => <button key={l} type="button" className={chip(minutes === m)} onClick={() => setMinutes(m)}>{l}</button>)}
      </div>
      <Button onClick={() => void ask()} disabled={loading}>{loading ? "Searching…" : picks ? "✨ More ideas" : "✨ Suggest"}</Button>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {picks ? (
        <ul className="space-y-2">
          {picks.map((p) => (
            <li key={p.title} className="space-y-1 rounded-xl border border-border p-3">
              <p className="font-medium">{p.title} <span className="text-xs font-normal text-fg-muted">· {p.kind}{p.language ? ` · ${p.language}` : ""}{p.where_to_watch ? ` · ${p.where_to_watch}` : ""}</span></p>
              <InfoLine year={p.year} rating={p.imdb_rating} genres={p.genres} runtime={p.runtime_minutes} kind={p.kind} episodes={p.total_seasons ? null : p.total_episodes} />
              <p className="text-sm">{p.why}</p>
              <details className="text-xs text-fg-muted"><summary className="cursor-pointer">What&apos;s it about?</summary><p className="mt-1">{p.overview}</p></details>
              <div className="flex gap-2 pt-1">
                {added.includes(p.title) ? (
                  <span className="text-sm text-accent">✓ On your list</span>
                ) : (
                  <>
                    {(["want", "watching"] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === "want" ? "secondary" : "ghost"}
                        disabled={pending}
                        onClick={() => start(async () => {
                          const r = await addWatchSuggestion(p, s);
                          if (r.error) return toast(r.error, { tone: "error" });
                          setAdded((a) => [...a, p.title]);
                          toast(r.message ?? "Added.", { kind: "save" });
                        })}
                      >
                        {s === "want" ? "+ Want to watch" : "Watch tonight"}
                      </Button>
                    ))}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
      <p className="text-xs text-fg-muted">Ratings and streaming are checked on the web when you ask and can change.</p>
    </Card>
  );
}

/** Fetches year, IMDb rating, genres, seasons and where it streams for an item already on the list. */
export function LookupButton({ itemId, again = false }: { itemId: string; again?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      className={cx("inline-flex items-center gap-1 text-xs", again ? "text-fg-muted hover:text-accent" : "text-accent")}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/ai/watch-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "Couldn't look it up");
          if (!body.found) toast("Couldn't find that title. Check the spelling under Edit.", { tone: "error" });
          else toast(body.imdb_rating != null ? `IMDb ${Number(body.imdb_rating).toFixed(1)}` : "Details added", { kind: "ai", detail: body.where_to_watch ?? null });
          router.refresh();
        } catch (e) {
          toast((e as Error).message, { tone: "error" });
        } finally {
          setLoading(false);
        }
      }}
    >
      <Sparkles className="size-3.5" aria-hidden /> {loading ? "Looking up…" : again ? "Refresh details" : "Look up rating & details"}
    </button>
  );
}

/** Looks up details for the titles that don't have them yet, ten at a time (each one is an AI request). */
export function LookupAll({ ids }: { ids: string[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [done, setDone] = useState<number | null>(null);
  const batch = ids.slice(0, 10);
  return (
    <button
      type="button"
      disabled={done !== null}
      className="inline-flex items-center gap-1.5 text-sm text-accent disabled:text-fg-muted"
      onClick={async () => {
        setDone(0);
        let ok = 0;
        for (const id of batch) {
          try {
            const res = await fetch("/api/ai/watch-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id }) });
            if (res.status === 429) {
              toast((await res.json()).error ?? "Daily AI limit reached.", { tone: "error" });
              break;
            }
            if (res.ok) ok++;
          } catch {
            /* carry on with the rest */
          }
          setDone((d) => (d ?? 0) + 1);
        }
        toast(`Details added for ${ok} title${ok === 1 ? "" : "s"}`, { kind: "ai" });
        setDone(null);
        router.refresh();
      }}
    >
      <Sparkles className="size-4" aria-hidden />
      {done !== null ? `Looking up ${done + 1 > batch.length ? batch.length : done + 1} of ${batch.length}…` : `Look up IMDb ratings & details for ${batch.length}${ids.length > batch.length ? ` of ${ids.length}` : ""} titles`}
    </button>
  );
}
