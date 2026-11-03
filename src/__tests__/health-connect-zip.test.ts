import { describe, expect, it, vi } from "vitest";
import initSqlJs from "sql.js";
import { zipSync } from "fflate";
import { entryDataRange, inflateEntry, listZip } from "@/modules/wearables/zip-entry";

vi.mock("server-only", () => ({}));

/** A zip in memory, read the way Drive is: by byte ranges, recording what was asked for. */
function rangeSource(zip: Uint8Array) {
  const reads: number[] = [];
  return {
    reads,
    src: {
      size: zip.length,
      read: async (s: number, e: number) => (reads.push(e - s), zip.slice(s, e)),
      stream: async (s: number, e: number) => (reads.push(e - s), new Blob([zip.slice(s, e)]).stream()),
    },
  };
}

async function exportDb(days: number) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE steps_record_table (start_time INTEGER, start_zone_offset INTEGER, count INTEGER, app_info_id INTEGER)");
  for (let i = 0; i < days; i++) db.run("INSERT INTO steps_record_table VALUES (?,?,?,?)", [Date.parse("2026-11-01T04:00:00Z") - i * 864e5, 19800, 9000 + i, 1]);
  // Padding so the db is much bigger than the bits of the zip we read to find it.
  db.run("CREATE TABLE padding (x BLOB)");
  db.run("INSERT INTO padding VALUES (randomblob(300000))");
  return db.export();
}

describe("zip entries without reading the whole zip", () => {
  it("lists files and inflates one, stored or deflated, with a zip comment", async () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 251);
    for (const level of [0, 6] as const) {
      const zip = zipSync({ "a.txt": new TextEncoder().encode("hello"), "dir/data.bin": big }, { level, comment: "x".repeat(1000) } as never);
      const { src } = rangeSource(zip);
      const entries = await listZip(src.read, src.size);
      expect(entries.map((e) => e.name)).toEqual(["a.txt", "dir/data.bin"]);
      const e = entries[1];
      expect(e.size).toBe(big.length);
      const r = await entryDataRange(src.read, e);
      const out = new Uint8Array(await new Response(inflateEntry(await src.stream(r.start, r.end), e)).arrayBuffer());
      expect(out).toEqual(big);
    }
  });

  it("rejects something that isn't a zip", async () => {
    const { src } = rangeSource(new Uint8Array(500).fill(7));
    await expect(listZip(src.read, src.size)).rejects.toThrow(/isn't a zip/);
  });
});

describe("Health Connect export, as the daily sync reads it", () => {
  it("pulls the .db out by range, reads it from disk and keeps only recent days", async () => {
    const zip = zipSync({ "Health Connect/health_connect_export.db": await exportDb(10), "readme.txt": new Uint8Array([1]) });
    const { src, reads } = rangeSource(zip);
    const { readHealthConnectZip } = await import("@/lib/health-connect-import");
    const all = await readHealthConnectZip(src, "Asia/Kolkata");
    expect(all.days).toHaveLength(10);
    expect(all.days.at(-1)).toEqual({ day: "2026-11-01", steps: 9000 });
    // Only the end directory, a header and the db's own bytes were read: never the whole zip in one go besides that.
    expect(reads.filter((n) => n === zip.length)).toHaveLength(0);

    const recent = await readHealthConnectZip(src, "Asia/Kolkata", "2026-10-30");
    expect(recent.days.map((d) => d.day)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(recent.missing).toContain("sleep");

    const none = rangeSource(zipSync({ "notes.txt": new Uint8Array([1]) })).src;
    await expect(readHealthConnectZip(none, "Asia/Kolkata")).rejects.toThrow(/No \.db file/);
  });
});

describe("Health Connect export, read on the device (manual upload)", () => {
  it("reads a picked .zip in slices with sql.js", async () => {
    vi.doMock("sql.js", async () => {
      const real = (await vi.importActual<{ default: typeof initSqlJs }>("sql.js")).default;
      // In the browser the wasm comes from /public; here, from node_modules.
      return { default: () => real() };
    });
    const { readExportInBrowser } = await import("@/app/(app)/wearables/read-export");
    const file = new File([zipSync({ "health_connect_export.db": await exportDb(3) })], "Health Connect.zip");
    const s = await readExportInBrowser(file, "Asia/Kolkata");
    expect(s.days.map((d) => d.steps)).toEqual([9002, 9001, 9000]);
    vi.doUnmock("sql.js");
  });
});
