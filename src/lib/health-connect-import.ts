import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pickDbEntry, summarizeHealthConnect, type HcSummary } from "@/modules/wearables/health-connect";
import { addDays } from "@/lib/dates";

let sql: Promise<SqlJsStatic> | null = null;
/** sql.js with its WebAssembly read from disk (bundled with the function via next.config). */
function sqlJs() {
  if (!sql) {
    const buf = readFileSync(join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm"));
    sql = initSqlJs({ wasmBinary: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer });
  }
  return sql;
}

/** Opens a Health Connect export (.zip with a .db inside, or the .db itself) and summarises it per day. */
export async function readHealthConnectExport(bytes: Uint8Array, tz: string, sinceDay?: string): Promise<HcSummary> {
  let dbBytes = bytes;
  // A zip starts with "PK"; otherwise assume it's already the SQLite file.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes, { filter: (f) => /\.db$/i.test(f.name) });
    const name = pickDbEntry(Object.keys(files));
    if (!name) throw new Error("No .db file inside the zip. Is this a Health Connect export?");
    dbBytes = files[name];
  }
  const SQL = await sqlJs();
  const db = new SQL.Database(dbBytes);
  try {
    const query = (q: string) => {
      const res = db.exec(q);
      if (!res.length) return [];
      return res[0].values.map((row) => Object.fromEntries(res[0].columns.map((c, i) => [c, row[i]])));
    };
    return summarizeHealthConnect(query, tz, { sinceDay });
  } finally {
    db.close();
  }
}

export type ImportResult = { days: number; weights: number; firstDay: string | null; lastDay: string | null; found: string[]; missing: string[] };

/**
 * Saves a summary for one person: per-day wearable numbers (only the fields
 * found, so manual entries for other fields stay), and weigh-ins into Body
 * on days that don't have one yet.
 */
export async function saveHealthConnect(db: SupabaseClient, ownerId: string, householdId: string, s: HcSummary, opts: { bodyOn: boolean }): Promise<ImportResult> {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const d of s.days) {
    const { day, ...metrics } = d;
    const fields = Object.entries(metrics).filter(([, v]) => v !== undefined);
    if (!fields.length) continue;
    const key = fields.map(([k]) => k).sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), { owner_id: ownerId, household_id: householdId, day, source: "health_connect", ...Object.fromEntries(fields) }]);
  }
  for (const rows of groups.values()) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("wearable_daily").upsert(rows.slice(i, i + 500), { onConflict: "owner_id,day" });
      if (error) throw new Error(`Couldn't save the days (${error.message}).`);
    }
  }
  let weights = 0;
  if (opts.bodyOn && s.weights.length) {
    const first = s.weights[0].day;
    const { data: existing } = await db.from("body_metrics").select("measured_at").eq("owner_id", ownerId).not("weight_kg", "is", null).gte("measured_at", `${addDays(first, -1)}T00:00:00Z`);
    const have = new Set(((existing ?? []) as { measured_at: string }[]).map((m) => m.measured_at.slice(0, 10)));
    // One weigh-in per day: the last reading that day.
    const lastPerDay = new Map(s.weights.map((w) => [w.day, w]));
    const rows = [...lastPerDay.values()].filter((w) => !have.has(w.at.slice(0, 10))).map((w) => ({ owner_id: ownerId, created_by: ownerId, household_id: householdId, measured_at: w.at, weight_kg: w.weight_kg, notes: "From Health Connect" }));
    if (rows.length) {
      const { error } = await db.from("body_metrics").insert(rows);
      if (!error) weights = rows.length;
    }
  }
  return { days: s.days.length, weights, firstDay: s.days[0]?.day ?? null, lastDay: s.days.at(-1)?.day ?? null, found: s.found, missing: s.missing };
}
