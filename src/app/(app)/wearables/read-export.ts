"use client";

import { pickDbEntry, summarizeHealthConnect, type HcSummary } from "@/modules/wearables/health-connect";
import { entryDataRange, inflateEntry, listZip, type ReadRange } from "@/modules/wearables/zip-entry";

/** The .db out of a picked export, reading the zip in slices (it isn't loaded whole). */
async function dbBytes(file: File): Promise<Uint8Array> {
  if (/\.db$/i.test(file.name)) return new Uint8Array(await file.arrayBuffer());
  const read: ReadRange = async (s, e) => new Uint8Array(await file.slice(s, e).arrayBuffer());
  const entries = await listZip(read, file.size);
  const name = pickDbEntry(entries.map((e) => e.name));
  const entry = entries.find((e) => e.name === name);
  if (!entry) throw new Error("No .db file inside the zip. Is this a Health Connect export?");
  const { start, end } = await entryDataRange(read, entry);
  const out = new Uint8Array(entry.size);
  let at = 0;
  const reader = inflateEntry(file.slice(start, end).stream(), entry).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (at + value.length > out.length) throw new Error("The export's database is larger than the zip says.");
    out.set(value, at);
    at += value.length;
  }
  return at === out.length ? out : out.subarray(0, at);
}

/** Reads a Health Connect export on this device and returns the per-day summary. */
export async function readExportInBrowser(file: File, tz: string): Promise<HcSummary> {
  const initSqlJs = (await import("sql.js")).default;
  const [SQL, bytes] = await Promise.all([initSqlJs({ locateFile: () => "/sql-wasm-1.13.0.wasm" }), dbBytes(file)]);
  const db = new SQL.Database(bytes);
  try {
    return summarizeHealthConnect(
      function* (q) {
        const st = db.prepare(q);
        try {
          while (st.step()) yield st.getAsObject() as Record<string, unknown>;
        } finally {
          st.free();
        }
      },
      tz,
    );
  } finally {
    db.close();
  }
}
