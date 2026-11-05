import "server-only";

import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exerciseName, pickDbEntry, summarizeHealthConnect, type HcSession, type HcSummary } from "@/modules/wearables/health-connect";
import { entryDataRange, inflateEntry, listZip, type ReadRange } from "@/modules/wearables/zip-entry";
import { addDays } from "@/lib/dates";

/** The unzipped database has to fit in the function's temporary disk (Vercel gives 500 MB). */
export const MAX_DB_BYTES = 480 * 1024 * 1024;

export type ZipSource = {
  size: number;
  read: ReadRange;
  /** Bytes [start, end) as a stream, for the big compressed .db. */
  stream: (start: number, end: number) => Promise<ReadableStream<Uint8Array>>;
};

/**
 * Pulls the .db out of a Health Connect export zip into a temporary file,
 * reads it with Node's built-in SQLite (from disk, not memory), summarises
 * it per day and deletes the file.
 */
export async function readHealthConnectZip(src: ZipSource, tz: string, sinceDay?: string): Promise<HcSummary> {
  const entries = await listZip(src.read, src.size);
  const name = pickDbEntry(entries.map((e) => e.name));
  const entry = entries.find((e) => e.name === name);
  if (!entry) throw new Error("No .db file inside the zip. Is this a Health Connect export?");
  if (entry.size > MAX_DB_BYTES) throw new Error(`The database in the export is ${Math.round(entry.size / 1048576)} MB unzipped, more than Hearth can read in one go (${MAX_DB_BYTES / 1048576} MB).`);
  const range = await entryDataRange(src.read, entry);
  const dir = await mkdtemp(join(tmpdir(), "hc-"));
  const file = join(dir, "export.db");
  try {
    let written = 0;
    const guard = new Transform({
      transform(chunk: Buffer, _enc, done) {
        written += chunk.length;
        done(written > MAX_DB_BYTES ? new Error("The export's database is larger than it says.") : null, chunk);
      },
    });
    const body = inflateEntry(await src.stream(range.start, range.end), entry);
    await pipeline(Readable.fromWeb(body as unknown as NodeReadableStream<Uint8Array>), guard, createWriteStream(file));
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      return summarizeHealthConnect((q) => db.prepare(q).iterate() as Iterable<Record<string, unknown>>, tz, { sinceDay });
    } finally {
      db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const DRIVE = "https://www.googleapis.com/drive/v3/files";

/**
 * A Google Drive file read by byte ranges with the short-lived access token
 * the person's own Apps Script hands over, so nothing has to be uploaded.
 */
export async function driveZip(fileId: string, accessToken: string): Promise<ZipSource & { name: string; modified: string }> {
  if (!/^[\w-]{10,200}$/.test(fileId)) throw new Error("Invalid Drive file id.");
  const auth = { Authorization: `Bearer ${accessToken}` };
  const metaRes = await fetch(`${DRIVE}/${fileId}?fields=name,size,modifiedTime&supportsAllDrives=true`, { headers: auth });
  if (metaRes.status === 401 || metaRes.status === 403) throw new Error("Google Drive refused access. Run the script's setup again and allow Drive access.");
  if (!metaRes.ok) throw new Error(`Couldn't find the export in Google Drive (${metaRes.status}).`);
  const meta = (await metaRes.json()) as { name: string; size?: string; modifiedTime: string };
  const size = Number(meta.size);
  if (!Number.isFinite(size) || size <= 0) throw new Error("That Drive file has no size (is it a Google Doc rather than the .zip?).");
  const get = async (start: number, end: number) => {
    const res = await fetch(`${DRIVE}/${fileId}?alt=media&supportsAllDrives=true`, { headers: { ...auth, Range: `bytes=${start}-${end - 1}` } });
    // 206 = just the range. A 200 would be the whole file, which is what we're avoiding.
    if (res.status !== 206 && !(res.status === 200 && start === 0 && end === size)) {
      await res.body?.cancel();
      throw new Error(`Google Drive didn't send the requested part of the file (${res.status}).`);
    }
    if (!res.body) throw new Error("Google Drive sent an empty response.");
    return res.body;
  };
  return {
    name: meta.name,
    modified: meta.modifiedTime,
    size,
    read: async (start, end) => new Uint8Array(await new Response(await get(start, end)).arrayBuffer()),
    stream: get,
  };
}

export type ImportResult = { days: number; weights: number; workouts: number; firstDay: string | null; lastDay: string | null; found: string[]; missing: string[] };

/**
 * Saves a summary for one person: per-day wearable numbers (only the fields
 * found, so manual entries for other fields stay), and weigh-ins into Body
 * on days that don't have one yet.
 */
export async function saveHealthConnect(db: SupabaseClient, ownerId: string, householdId: string, s: Pick<HcSummary, "days" | "weights" | "found" | "missing"> & { sessions?: HcSession[] }, opts: { bodyOn: boolean; fitnessOn?: boolean }): Promise<ImportResult> {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const d of s.days) {
    const { day, ...metrics } = d;
    const fields = Object.entries(metrics).filter(([, v]) => v !== undefined && v !== null);
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
  const workouts = opts.fitnessOn && s.sessions?.length ? await saveSessions(db, ownerId, householdId, s.sessions) : 0;
  return { days: s.days.length, weights, workouts, firstDay: s.days[0]?.day ?? null, lastDay: s.days.at(-1)?.day ?? null, found: s.found, missing: s.missing };
}

/**
 * Workout sessions from the band or phone become workouts in Fitness, so
 * they count toward weekly goals. Each is saved once (keyed by its start
 * time), edits made in Hearth are kept, and a day where that kind of workout
 * was already logged by hand isn't doubled.
 */
export async function saveSessions(db: SupabaseClient, ownerId: string, householdId: string, sessions: HcSession[]) {
  if (!sessions.length) return 0;
  const first = sessions.reduce((a, x) => (x.day < a ? x.day : a), sessions[0].day);
  const { data: manual } = await db.from("workout_logs").select("performed_on, kind").eq("owner_id", ownerId).is("external_id", null).eq("status", "done").gte("performed_on", first);
  const had = new Set(((manual ?? []) as { performed_on: string; kind: string }[]).map((m) => `${m.performed_on}:${m.kind}`));
  const rows = sessions
    .filter((x) => !had.has(`${x.day}:${x.kind}`))
    .map((x) => ({ owner_id: ownerId, household_id: householdId, performed_on: x.day, kind: x.kind, title: exerciseName(x.type), status: "done", duration_minutes: x.minutes, external_id: `hc:${x.start}`, notes: "From Health Connect" }));
  let saved = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await db.from("workout_logs").upsert(rows.slice(i, i + 500), { onConflict: "owner_id,external_id", ignoreDuplicates: true }).select("id");
    if (error) {
      // Older database without the column: skip workouts, keep the rest of the import.
      if (error.code === "42703" || error.code === "42P10") return 0;
      throw new Error(`Couldn't save the workouts (${error.message}).`);
    }
    saved += data?.length ?? 0;
  }
  return saved;
}
