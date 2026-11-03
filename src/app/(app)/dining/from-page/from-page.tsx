"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { placeKey } from "@/modules/dining/bulk";
import { placeFromTitle } from "@/modules/dining/bookmarklet";
import { MenuImport } from "../menu-import";
import { createPlaceQuick } from "../actions";

type Grabbed = { title: string; url: string; text: string };

function isGrabbed(d: unknown): d is Grabbed & { type: string } {
  const x = d as Record<string, unknown> | null;
  return Boolean(x && x.type === "hearth-menu" && typeof x.text === "string" && typeof x.title === "string" && typeof x.url === "string");
}

/**
 * Receives a restaurant page copied with the "Copy menu to Hearth" bookmark
 * (or its downloaded hearth-menu.json), then reads it like pasted menu text.
 */
export function FromPage({ places }: { places: { id: string; name: string }[] }) {
  const router = useRouter();
  const [page, setPage] = useState<Grabbed | null>(null);
  const [waited, setWaited] = useState(false);
  const [placeId, setPlaceId] = useState("");
  const [newName, setNewName] = useState("");
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function receive(d: Grabbed) {
    const text = d.text.slice(0, 300000);
    setPage({ title: d.title.slice(0, 300), url: d.url.slice(0, 500), text });
    const guess = placeFromTitle(d.title);
    const match = places.find((p) => placeKey(p.name) === placeKey(guess));
    setPlaceId(match?.id ?? "");
    setNewName(match ? "" : guess);
  }

  // Tell the restaurant tab we're ready, until it sends the menu.
  useEffect(() => {
    const opener = window.opener as Window | null;
    const onMessage = (e: MessageEvent) => {
      if (opener && e.source === opener && isGrabbed(e.data)) receive(e.data);
    };
    window.addEventListener("message", onMessage);
    let tries = 0;
    const ping = window.setInterval(() => {
      tries += 1;
      try {
        opener?.postMessage("hearth-ready", "*");
      } catch {
        /* ignore */
      }
      if (tries > 30) {
        window.clearInterval(ping);
        setWaited(true);
      }
    }, 500);
    const slow = window.setTimeout(() => setWaited(true), 4000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(ping);
      window.clearTimeout(slow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (chosen && page) {
    return (
      <MenuImport
        placeId={chosen.id}
        placeName={chosen.name}
        initialText={`Restaurant page: ${page.title}\n${page.url}\n\n${page.text}`}
        onDone={() => router.push("/dining")}
      />
    );
  }

  if (!page) {
    return (
      <Card className="space-y-3">
        <p className="font-medium">{waited ? "Waiting for the menu…" : "Receiving the menu…"}</p>
        {waited ? (
          <>
            <p className="text-sm text-fg-muted">If nothing arrives, the restaurant site blocked the hand-over and saved a file called <strong>hearth-menu.json</strong> instead (check Downloads). Upload it here:</p>
            <label className="pressable inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
              📄 Choose hearth-menu.json
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const d = JSON.parse(await f.text());
                    if (!isGrabbed(d)) throw new Error();
                    receive(d);
                  } catch {
                    setError("That isn't a file from the Copy menu to Hearth button.");
                  }
                }}
              />
            </label>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <p className="text-xs text-fg-muted">Opened this page by hand? Use the “Copy menu to Hearth” bookmark on a restaurant page (see Dining → Copy whole menus).</p>
          </>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-medium">Menu received: {Math.round(page.text.length / 1000)}k characters</p>
        <p className="truncate text-xs text-fg-muted">{page.title}</p>
      </div>
      {places.length ? (
        <Field label="Saved restaurant">
          <Select value={placeId} onChange={(e) => { setPlaceId(e.target.value); if (e.target.value) setNewName(""); }}>
            <option value="">– New restaurant –</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      {!placeId ? (
        <Field label="New restaurant">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} />
        </Field>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        disabled={pending || (!placeId && !newName.trim())}
        onClick={() =>
          start(async () => {
            if (placeId) return setChosen({ id: placeId, name: places.find((p) => p.id === placeId)?.name ?? "" });
            const r = await createPlaceQuick(newName);
            if (r.error || !r.id) return setError(r.error ?? "Couldn't add the place.");
            setChosen({ id: r.id, name: newName.trim() });
          })
        }
      >
        Continue
      </Button>
    </Card>
  );
}
