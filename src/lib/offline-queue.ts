"use client";

/**
 * Taps made without a connection (water, a dose, a supplement) are kept on
 * this device and sent when it's back online, with the time they were made.
 * Kept in localStorage; if that's unavailable the tap just fails as before.
 */
import { logWater } from "@/lib/water-actions";
import { logDose } from "@/app/(app)/medicines/actions";
import { toggleSupplement } from "@/app/(app)/supplements/actions";

export type QueuedJob =
  | { id: string; kind: "water"; at: string; label: string; args: { ml: number; day?: string; ownerId?: string } }
  | { id: string; kind: "dose"; at: string; label: string; args: { medicineId: string; ownerId: string; date: string; time: string | null; status: "taken" | "skipped" } }
  | { id: string; kind: "supplement"; at: string; label: string; args: { supplementId: string; ownerId: string; date: string } };

const KEY = "hearth.offline.queue";
export const QUEUE_EVENT = "hearth:offline-queue";

export function readQueue(): QueuedJob[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedJob[];
  } catch {
    return [];
  }
}
function writeQueue(q: QueuedJob[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q.slice(-100)));
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {
    /* ignore */
  }
}

/** A failure that means "no connection" (so the tap is worth keeping), not "the server said no". */
export function isOffline(e?: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return /fetch|network|load failed|connection/i.test(m);
}

export function enqueue(job: Omit<QueuedJob, "id" | "at">): QueuedJob {
  const full = { ...job, id: crypto.randomUUID(), at: new Date().toISOString() } as QueuedJob;
  writeQueue([...readQueue(), full]);
  return full;
}

async function send(j: QueuedJob) {
  if (j.kind === "water") return logWater(j.args.ml, j.args.day, j.args.ownerId, j.at);
  if (j.kind === "dose") return logDose(j.args.medicineId, j.args.ownerId, j.args.date, j.args.time, j.args.status, j.at);
  return toggleSupplement(j.args.supplementId, j.args.ownerId, j.args.date, true, j.at);
}

let flushing = false;
/** Sends what's waiting, oldest first. Returns how many went through and how many the server refused. */
export async function flushQueue(): Promise<{ sent: number; failed: string[] }> {
  if (flushing || (typeof navigator !== "undefined" && navigator.onLine === false)) return { sent: 0, failed: [] };
  flushing = true;
  let sent = 0;
  const failed: string[] = [];
  try {
    for (const j of readQueue()) {
      try {
        const r = await send(j);
        if (r?.error) failed.push(`${j.label}: ${r.error}`);
        else sent += 1;
        writeQueue(readQueue().filter((x) => x.id !== j.id));
      } catch (e) {
        if (isOffline(e)) break; // still offline: keep the rest for later
        writeQueue(readQueue().filter((x) => x.id !== j.id));
        failed.push(j.label);
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}

/**
 * Runs a logging action; if there's no connection, keeps it for later and
 * reports `queued` instead of failing.
 */
export async function runOrQueue<R extends { error?: string }>(job: Omit<QueuedJob, "id" | "at">, run: () => Promise<R>): Promise<R | { queued: true; error?: undefined }> {
  if (isOffline()) {
    enqueue(job);
    return { queued: true };
  }
  try {
    return await run();
  } catch (e) {
    if (!isOffline(e)) throw e;
    enqueue(job);
    return { queued: true };
  }
}
