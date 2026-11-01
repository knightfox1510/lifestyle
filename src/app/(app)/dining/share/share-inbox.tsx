"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, EmptyState, Field, Input, Notice, Select } from "@/components/ui";
import { MenuImport } from "../menu-import";
import { createPlaceQuick } from "../actions";

const SHARE_CACHE = "share-inbox";

async function readShared(): Promise<File[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(SHARE_CACHE);
  const keys = await cache.keys();
  const files: File[] = [];
  for (const req of keys) {
    const res = await cache.match(req);
    if (!res) continue;
    const blob = await res.blob();
    const name = decodeURIComponent(res.headers.get("X-File-Name") ?? "shared.jpg");
    files.push(new File([blob], name, { type: blob.type || "image/jpeg" }));
  }
  return files;
}

/** Receives screenshots shared into the app and imports them as a restaurant's menu. */
export function ShareInbox({ places }: { places: { id: string; name: string }[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[] | null>(null);
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    readShared().then(setFiles).catch(() => setFiles([]));
  }, []);

  async function done() {
    try {
      await caches.delete(SHARE_CACHE);
    } catch {
      /* ignore */
    }
    router.push("/dining");
  }

  if (files === null) return <p className="text-sm text-fg-muted">Loading shared images…</p>;
  if (!files.length) {
    return (
      <EmptyState title="Nothing was shared">
        On Android, open a menu screenshot (or the Zomato/Swiggy restaurant page screenshot) → Share → Hearth. On iPhone, use “Import menu” on a restaurant in Dining instead.
      </EmptyState>
    );
  }

  if (chosen) return <MenuImport placeId={chosen.id} placeName={chosen.name} initialFiles={files} onDone={done} />;

  return (
    <Card className="space-y-3">
      <p className="font-medium">{files.length} image{files.length === 1 ? "" : "s"} received. Which restaurant is this menu from?</p>
      {places.length ? (
        <Field label="Saved restaurant">
          <Select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label={places.length ? "…or a new one" : "Restaurant name"}>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} placeholder="e.g. Doolally Taproom" />
      </Field>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="flex gap-2">
        <Button
          disabled={pending || (!newName.trim() && !placeId)}
          onClick={() =>
            start(async () => {
              if (newName.trim()) {
                const r = await createPlaceQuick(newName);
                if (r.error || !r.id) return setError(r.error ?? "Couldn't add the place.");
                setChosen({ id: r.id, name: newName.trim() });
              } else {
                setChosen({ id: placeId, name: places.find((p) => p.id === placeId)?.name ?? "" });
              }
            })
          }
        >
          Continue
        </Button>
        <Button variant="ghost" onClick={done}>Cancel</Button>
      </div>
    </Card>
  );
}
