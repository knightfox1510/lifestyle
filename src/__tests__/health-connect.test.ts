import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { pickDbEntry, summarizeHealthConnect } from "@/modules/wearables/health-connect";

const IST = 19800; // +05:30 in seconds
const at = (iso: string) => Date.parse(iso);

async function exportDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE steps_record_table (row_id INTEGER PRIMARY KEY, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, count INTEGER, app_info_id INTEGER);
    CREATE TABLE total_calories_burned_record_table (row_id INTEGER PRIMARY KEY, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, energy REAL, app_info_id INTEGER);
    CREATE TABLE heart_rate_record_table (row_id INTEGER PRIMARY KEY, start_time INTEGER, end_time INTEGER);
    CREATE TABLE heart_rate_record_series_table (parent_key INTEGER, beats_per_minute INTEGER, epoch_millis INTEGER);
    CREATE TABLE resting_heart_rate_record_table (row_id INTEGER PRIMARY KEY, time INTEGER, zone_offset INTEGER, beats_per_minute INTEGER);
    CREATE TABLE sleep_session_record_table (row_id INTEGER PRIMARY KEY, start_time INTEGER, end_time INTEGER, end_zone_offset INTEGER, app_info_id INTEGER);
    CREATE TABLE sleep_stages_table (parent_key INTEGER, stage_start_time INTEGER, stage_end_time INTEGER, stage_type INTEGER);
    CREATE TABLE weight_record_table (row_id INTEGER PRIMARY KEY, time INTEGER, zone_offset INTEGER, weight REAL);
    CREATE TABLE exercise_session_record_table (row_id INTEGER PRIMARY KEY, start_time INTEGER, end_time INTEGER, start_zone_offset INTEGER, exercise_type INTEGER, app_info_id INTEGER);
  `);
  const ins = (sql: string, rows: unknown[][]) => rows.forEach((r) => db.run(sql, r as never[]));
  // 2 Nov: phone 6,000 steps and band 7,500 for the same day → 7,500, not 13,500.
  ins("INSERT INTO steps_record_table (start_time,end_time,start_zone_offset,count,app_info_id) VALUES (?,?,?,?,?)", [
    [at("2026-11-02T03:00:00Z"), at("2026-11-02T04:00:00Z"), IST, 6000, 1],
    [at("2026-11-02T03:00:00Z"), at("2026-11-02T04:00:00Z"), IST, 4500, 2],
    [at("2026-11-02T10:00:00Z"), at("2026-11-02T11:00:00Z"), IST, 3000, 2],
    // 20:00 UTC on 2 Nov is 01:30 on 3 Nov in India.
    [at("2026-11-02T20:00:00Z"), at("2026-11-02T20:30:00Z"), IST, 800, 2],
  ]);
  ins("INSERT INTO total_calories_burned_record_table (start_time,end_time,start_zone_offset,energy,app_info_id) VALUES (?,?,?,?,?)", [
    [at("2026-11-02T05:00:00Z"), at("2026-11-02T06:00:00Z"), IST, 1_200_000, 2],
    [at("2026-11-02T12:00:00Z"), at("2026-11-02T13:00:00Z"), IST, 900_000, 2],
  ]);
  ins("INSERT INTO heart_rate_record_series_table VALUES (?,?,?)", [[1, 60, at("2026-11-02T04:00:00Z")], [1, 80, at("2026-11-02T05:00:00Z")], [1, 300, at("2026-11-02T06:00:00Z")]]);
  ins("INSERT INTO resting_heart_rate_record_table (time,zone_offset,beats_per_minute) VALUES (?,?,?)", [[at("2026-11-02T02:00:00Z"), IST, 62], [at("2026-11-02T02:30:00Z"), IST, 58]]);
  // Slept 23:00 (1 Nov) → 06:30 (2 Nov) IST: 450 minutes, 90 deep.
  ins("INSERT INTO sleep_session_record_table (row_id,start_time,end_time,end_zone_offset,app_info_id) VALUES (?,?,?,?,?)", [[7, at("2026-11-01T17:30:00Z"), at("2026-11-02T01:00:00Z"), IST, 2]]);
  ins("INSERT INTO sleep_stages_table VALUES (?,?,?,?)", [[7, at("2026-11-01T18:00:00Z"), at("2026-11-01T19:00:00Z"), 5], [7, at("2026-11-01T22:00:00Z"), at("2026-11-01T22:30:00Z"), 5], [7, at("2026-11-01T19:00:00Z"), at("2026-11-01T20:00:00Z"), 4]]);
  ins("INSERT INTO weight_record_table (time,zone_offset,weight) VALUES (?,?,?)", [[at("2026-11-02T01:30:00Z"), IST, 72400]]);
  // Gym 07:00–08:00 IST (written by band and phone), a 5-minute stroll, and an evening walk.
  ins("INSERT INTO exercise_session_record_table (start_time,end_time,start_zone_offset,exercise_type,app_info_id) VALUES (?,?,?,?,?)", [
    [at("2026-11-02T01:30:00Z"), at("2026-11-02T02:30:00Z"), IST, 70, 1],
    [at("2026-11-02T01:31:00Z"), at("2026-11-02T02:30:00Z"), IST, 70, 2],
    [at("2026-11-02T05:00:00Z"), at("2026-11-02T05:05:00Z"), IST, 79, 2],
    [at("2026-11-02T13:00:00Z"), at("2026-11-02T13:40:00Z"), IST, 79, 2],
  ]);
  return db;
}

describe("Health Connect export", () => {
  it("turns raw records into per-day numbers", async () => {
    const db = await exportDb();
    const query = (sql: string) => {
      const res = db.exec(sql);
      if (!res.length) return [];
      return res[0].values.map((row) => Object.fromEntries(res[0].columns.map((c, i) => [c, row[i]])));
    };
    const s = summarizeHealthConnect(query, "Asia/Kolkata");
    const nov2 = s.days.find((d) => d.day === "2026-11-02")!;
    expect(nov2).toMatchObject({ steps: 7500, calories_burned: 2100, avg_hr: 70, resting_hr: 58, sleep_minutes: 450, deep_sleep_minutes: 90 });
    expect(s.days.find((d) => d.day === "2026-11-03")!.steps).toBe(800);
    expect(s.weights).toEqual([{ day: "2026-11-02", at: "2026-11-02T01:30:00.000Z", weight_kg: 72.4 }]);
    expect(s.found).toEqual(expect.arrayContaining(["steps", "sleep", "deep sleep", "heart rate", "weight"]));
    expect(s.sessions.map((x) => [x.day, x.kind, x.minutes])).toEqual([["2026-11-02", "gym", 60], ["2026-11-02", "walk", 40]]);
    // Only new days when asked.
    expect(summarizeHealthConnect(query, "Asia/Kolkata", { sinceDay: "2026-11-03" }).days.map((d) => d.day)).toEqual(["2026-11-03"]);
  });
  it("finds the database inside the zip", () => {
    expect(pickDbEntry(["__MACOSX/._health_connect_export.db", "health_connect_export.db", "readme.txt"])).toBe("health_connect_export.db");
    expect(pickDbEntry(["notes.txt"])).toBeNull();
  });
});
