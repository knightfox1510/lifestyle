/**
 * Turns wearable CSV exports into daily rows. Understands Zepp / Amazfit
 * exports (ACTIVITY, SLEEP, HEARTRATE_AUTO files) and simple generic CSVs
 * with headers like date, steps, sleep_minutes, resting_hr.
 * Every row from one file has the same keys, so an upsert only touches the
 * columns that file provides.
 */
export type DailyMetric = {
  day: string;
  steps?: number;
  resting_hr?: number;
  avg_hr?: number;
  sleep_minutes?: number;
  deep_sleep_minutes?: number;
  active_minutes?: number;
  calories_burned?: number;
  hrv_ms?: number;
};

export const METRIC_KEYS = ["steps", "resting_hr", "avg_hr", "sleep_minutes", "deep_sleep_minutes", "active_minutes", "calories_burned", "hrv_ms"] as const;

function splitLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toDay(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseWearableCsv(text: string): { rows: DailyMetric[]; kind: string } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], kind: "empty" };
  const headers = splitLine(lines[0]).map(norm);
  const col = (...names: string[]) => headers.findIndex((h) => names.includes(h));
  const iDate = col("date", "day", "datetime", "timestamp");
  if (iDate < 0) return { rows: [], kind: "unknown" };
  const data = lines.slice(1).map(splitLine);

  // Zepp HEARTRATE_AUTO: many readings per day → average + low (resting proxy).
  const iHr = col("heartrate", "hr", "bpm");
  const iTime = col("time");
  if (iHr >= 0 && iTime >= 0 && col("steps") < 0) {
    const byDay = new Map<string, number[]>();
    for (const r of data) {
      const d = toDay(r[iDate] ?? "");
      const v = num(r[iHr]);
      if (d && v && v > 25 && v < 230) byDay.set(d, [...(byDay.get(d) ?? []), v]);
    }
    const rows = [...byDay.entries()].map(([day, vs]) => {
      const sorted = [...vs].sort((a, b) => a - b);
      const low = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1)));
      return {
        day,
        avg_hr: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length),
        resting_hr: Math.round(low.reduce((a, b) => a + b, 0) / low.length),
      };
    });
    return { rows, kind: "heart rate" };
  }

  // Zepp SLEEP: deepSleepTime, shallowSleepTime, REMTime in minutes.
  const iDeep = col("deepsleeptime", "deepsleep", "deepsleepminutes", "deep");
  const iLight = col("shallowsleeptime", "lightsleeptime", "lightsleep", "light");
  const iRem = col("remtime", "rem", "remsleep");
  const iSleep = col("sleepminutes", "sleep", "totalsleep", "sleepduration", "asleepminutes");
  const iSteps = col("steps", "stepcount");
  const iResting = col("restinghr", "restingheartrate", "rhr");
  const iAvgHr = col("avghr", "averageheartrate", "avgheartrate");
  const iActive = col("activeminutes", "activetime", "exerciseminutes");
  const iCal = col("calories", "caloriesburned", "activecalories", "kcal");
  const iHrv = col("hrv", "hrvms", "rmssd");

  const rows: DailyMetric[] = [];
  const keys = new Set<keyof DailyMetric>(["day"]);
  for (const r of data) {
    const day = toDay(r[iDate] ?? "");
    if (!day) continue;
    const row: DailyMetric = { day };
    const set = (k: keyof Omit<DailyMetric, "day">, v: number | undefined, max: number) => {
      if (v !== undefined && v >= 0 && v <= max) {
        row[k] = Math.round(v);
        keys.add(k);
      }
    };
    set("steps", num(r[iSteps]), 200000);
    if (iDeep >= 0 || iLight >= 0) {
      const deep = num(r[iDeep]) ?? 0;
      const total = deep + (num(r[iLight]) ?? 0) + (num(r[iRem]) ?? 0);
      if (total > 0) {
        set("sleep_minutes", total, 1440);
        set("deep_sleep_minutes", deep, 1440);
      }
    } else set("sleep_minutes", num(r[iSleep]), 1440);
    set("resting_hr", num(r[iResting]), 220);
    set("avg_hr", num(r[iAvgHr]), 220);
    set("active_minutes", num(r[iActive]), 1440);
    set("calories_burned", num(r[iCal]), 20000);
    set("hrv_ms", num(r[iHrv]), 500);
    rows.push(row);
  }
  // Keep the last row per day and make all rows share the same keys.
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const uniform = [...byDay.values()]
    .map((r) => Object.fromEntries([...keys].map((k) => [k, r[k] ?? null])) as DailyMetric)
    .filter((r) => [...keys].some((k) => k !== "day" && r[k] != null));
  const kind = iDeep >= 0 || iLight >= 0 ? "sleep" : iSteps >= 0 ? "activity" : "daily metrics";
  return { rows: uniform, kind };
}
