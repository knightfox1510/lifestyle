"use client";

/**
 * Minimal IndexedDB helpers (no dependency). Stores:
 *  - "items":  cached rows, keyed by `${collection}:${id}`
 *  - "outbox": queued writes, auto-increment key, replayed in order when online
 * Every call degrades to a no-op if IndexedDB is unavailable (private mode etc.).
 */
const DB_NAME = "hearth";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("items")) db.createObjectStore("items");
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
          tx.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function cacheGetAll<T>(collection: string): Promise<T[]> {
  const range = IDBKeyRange.bound(`${collection}:`, `${collection}:￿`);
  return ((await run<T[]>("items", "readonly", (s) => s.getAll(range))) ?? []) as T[];
}

export function cachePut<T extends { id: string }>(collection: string, item: T) {
  return run("items", "readwrite", (s) => s.put(item, `${collection}:${item.id}`));
}

export function cachePutMany<T extends { id: string }>(collection: string, items: T[]) {
  return run("items", "readwrite", (s) => {
    for (const item of items) s.put(item, `${collection}:${item.id}`);
  });
}

export function cacheDelete(collection: string, id: string) {
  return run("items", "readwrite", (s) => s.delete(`${collection}:${id}`));
}

export type OutboxEntry<T> = { key: number; value: { collection: string; row: T } };

export async function outboxAdd<T>(collection: string, row: T) {
  await run("outbox", "readwrite", (s) => s.add({ collection, row }));
}

export async function outboxAll<T>(collection: string): Promise<OutboxEntry<T>[]> {
  const db = await open();
  if (!db) return [];
  return new Promise((resolve) => {
    const out: OutboxEntry<T>[] = [];
    try {
      const tx = db.transaction("outbox", "readonly");
      const req = tx.objectStore("outbox").openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return;
        const value = cur.value as { collection: string; row: T };
        if (value.collection === collection) out.push({ key: cur.key as number, value });
        cur.continue();
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
}

export function outboxRemove(key: number) {
  return run("outbox", "readwrite", (s) => s.delete(key));
}

/** Wipes all cached data (called on sign-out). */
export async function clearAll() {
  await run("items", "readwrite", (s) => s.clear());
  await run("outbox", "readwrite", (s) => s.clear());
}
