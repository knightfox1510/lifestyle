"use client";

import { useActionState, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Card, Checkbox, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { WatchInfo } from "@/lib/ai/watch-schemas";
import { addWatchItem } from "./actions";
import { InfoLine } from "./info-line";

export function AddWatchForm() {
  const [state, action] = useActionState(addWatchItem, null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("series");
  const [platform, setPlatform] = useState("");
  const [seasons, setSeasons] = useState("");
  const [info, setInfo] = useState<WatchInfo | null>(null);
  const [looking, setLooking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // A fresh form after each add.
  useEffect(() => {
    if (!state?.ok) return;
    const t = setTimeout(() => {
      setTitle("");
      setPlatform("");
      setSeasons("");
      setInfo(null);
      setMsg(null);
    }, 0);
    return () => clearTimeout(t);
  }, [state]);

  async function lookUp() {
    setLooking(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/watch-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), kind: kind === "other" ? undefined : kind }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't look it up");
      const i = body as WatchInfo;
      if (!i.found) {
        setMsg("Couldn't find that title. Check the spelling, or add it as it is.");
        return;
      }
      setInfo(i);
      setTitle(i.title);
      setKind(i.kind);
      if (i.where_to_watch && !platform) setPlatform(i.where_to_watch.slice(0, 60));
      if (i.total_seasons) setSeasons(String(i.total_seasons));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLooking(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">
        + Add a show or movie
      </button>
    );
  }
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <Field label="Title" className="sm:col-span-2">
          <div className="flex gap-2">
            <Input name="title" required maxLength={150} placeholder="Panchayat" value={title} onChange={(e) => { setTitle(e.target.value); setInfo(null); }} />
            <Button type="button" size="sm" variant="secondary" disabled={looking || !title.trim()} onClick={() => void lookUp()} aria-label="Look up details">
              <Sparkles className="size-4" aria-hidden /> {looking ? "Looking…" : "Look up"}
            </Button>
          </div>
        </Field>
        <Field label="Type">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="series">Series</option>
            <option value="movie">Movie</option>
            <option value="documentary">Documentary</option>
            <option value="anime">Anime</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Where"><Input name="platform" maxLength={60} placeholder="Netflix, JioHotstar, Prime…" value={platform} onChange={(e) => setPlatform(e.target.value)} /></Field>
        {info || msg ? (
          <div className="rounded-xl bg-surface-2/60 p-3 text-sm sm:col-span-4">
            {info ? (
              <>
                <InfoLine year={info.year} rating={info.imdb_rating} genres={info.genres} runtime={info.runtime_minutes} kind={info.kind} episodes={info.total_episodes} />
                <p className="mt-1 text-fg-muted">{info.overview}</p>
                {info.note ? <p className="mt-1 text-xs text-fg-muted">{info.note}</p> : null}
              </>
            ) : (
              <p className="text-fg-muted">{msg}</p>
            )}
          </div>
        ) : null}
        <input type="hidden" name="info" value={info ? JSON.stringify({ year: info.year, imdb_rating: info.imdb_rating, genres: info.genres, overview: info.overview, runtime_minutes: info.runtime_minutes, total_episodes: info.total_episodes }) : ""} />
        <Field label="Status">
          <Select name="status" defaultValue="want">
            <option value="want">Want to watch</option>
            <option value="watching">Watching</option>
          </Select>
        </Field>
        <Field label="Seasons"><Input name="total_seasons" type="number" min={1} max={100} value={seasons} onChange={(e) => setSeasons(e.target.value)} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Input name="notes" maxLength={500} placeholder="Recommended by…" /></Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
          <Checkbox name="together" defaultChecked label="We watch this together" />
          <SubmitButton>Add</SubmitButton>
          <button type="button" className="text-sm text-fg-muted" onClick={() => setOpen(false)}>Close</button>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
