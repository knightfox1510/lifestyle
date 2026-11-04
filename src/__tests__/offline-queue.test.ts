import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: unknown[][] = [];
vi.mock("@/lib/water-actions", () => ({ logWater: vi.fn(async (...a: unknown[]) => (calls.push(["water", ...a]), { ok: true })) }));
vi.mock("@/app/(app)/medicines/actions", () => ({ logDose: vi.fn(async (...a: unknown[]) => (calls.push(["dose", ...a]), { error: "Not allowed" })) }));
vi.mock("@/app/(app)/supplements/actions", () => ({ toggleSupplement: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) }));

const store = new Map<string, string>();
let online = true;
beforeEach(() => {
  store.clear();
  calls.length = 0;
  online = true;
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.stubGlobal("window", Object.assign(new EventTarget(), {}));
  vi.stubGlobal("navigator", { get onLine() { return online; } });
});

describe("offline logging queue", () => {
  it("queues while offline, then sends with the original time; refused ones are dropped with a reason", async () => {
    const q = await import("@/lib/offline-queue");
    online = false;
    const r = await q.runOrQueue({ kind: "water", label: "+250 ml", args: { ml: 250 } }, async () => ({ ok: true }) as { ok: boolean; error?: string });
    expect(r).toEqual({ queued: true });
    q.enqueue({ kind: "dose", label: "Dose taken", args: { medicineId: "m", ownerId: "o", date: "2026-11-04", time: "08:00", status: "taken" } });
    expect(q.readQueue()).toHaveLength(2);
    const at = q.readQueue()[0].at;

    // Still offline: nothing is sent.
    expect(await q.flushQueue()).toEqual({ sent: 0, failed: [] });

    online = true;
    const res = await q.flushQueue();
    expect(res.sent).toBe(1);
    expect(res.failed).toEqual(["Dose taken: Not allowed"]);
    expect(calls[0]).toEqual(["water", 250, undefined, undefined, at]);
    expect(q.readQueue()).toHaveLength(0);
  });

  it("keeps a job when the connection drops again mid-sync", async () => {
    const q = await import("@/lib/offline-queue");
    q.enqueue({ kind: "supplement", label: "D3 taken", args: { supplementId: "s", ownerId: "o", date: "2026-11-04" } });
    const res = await q.flushQueue();
    expect(res).toEqual({ sent: 0, failed: [] });
    expect(q.readQueue()).toHaveLength(1);
  });
});
