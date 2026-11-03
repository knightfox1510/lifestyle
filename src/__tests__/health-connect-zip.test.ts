import { describe, expect, it, vi } from "vitest";
import initSqlJs from "sql.js";
import { zipSync } from "fflate";

vi.mock("server-only", () => ({}));

describe("Health Connect export file", () => {
  it("reads the .db inside a zip, as the daily sync does", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE steps_record_table (start_time INTEGER, start_zone_offset INTEGER, count INTEGER, app_info_id INTEGER)");
    db.run("INSERT INTO steps_record_table VALUES (?,?,?,?)", [Date.parse("2026-11-01T04:00:00Z"), 19800, 9000, 1]);
    const zip = zipSync({ "health_connect_export.db": db.export() });
    const { readHealthConnectExport } = await import("@/lib/health-connect-import");
    const s = await readHealthConnectExport(zip, "Asia/Kolkata");
    expect(s.days).toEqual([{ day: "2026-11-01", steps: 9000 }]);
    expect(s.missing).toContain("sleep");
    await expect(readHealthConnectExport(zipSync({ "notes.txt": new Uint8Array([1]) }), "Asia/Kolkata")).rejects.toThrow(/No \.db file/);
  });
});
