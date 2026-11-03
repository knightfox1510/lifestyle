/**
 * Reads a Health Connect export (the .db inside the .zip that Android's
 * "Export data" / scheduled export writes) into per-day wearable numbers.
 *
 * Works against any SQLite handle through `query(sql) → rows`, so the same
 * code runs in the browser (manual upload) and on the server (daily sync).
 * It looks up the tables and columns that are actually there instead of
 * assuming one version of the schema, and reports what it found.
 *
 * Health Connect keeps raw records from every app, so the phone and a band
 * can both have written steps for the same hours. Per day we take the app
 * with the most (not the sum), which is what Health Connect itself shows.
 */

/** Runs SQL and yields rows (an iterator, so millions of heart-rate samples needn't sit in memory at once). */
export type Query = (sql: string) => Iterable<Record<string, unknown>>;

export type HcDay = {
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
export type HcWeight = { day: string; at: string; weight_kg: number };
export type HcSummary = { days: HcDay[]; weights: HcWeight[]; found: string[]; missing: string[]; tables: string[] };

const MIN = 60_000;

/** Local calendar day of an epoch-ms time, using the record's own zone offset (seconds) when stored, else `tz`. */
const formatters = new Map<string, Intl.DateTimeFormat>();
function dayOf(ms: number, offsetSec: number | null | undefined, tz: string) {
  if (offsetSec != null && Number.isFinite(Number(offsetSec))) return new Date(ms + Number(offsetSec) * 1000).toISOString().slice(0, 10);
  let f = formatters.get(tz);
  if (!f) formatters.set(tz, (f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })));
  return f.format(new Date(ms));
}

export function summarizeHealthConnect(query: Query, tz: string, opts: { sinceDay?: string } = {}): HcSummary {
  const tables = Array.from(query("SELECT name FROM sqlite_master WHERE type = 'table'"), (r) => String(r.name));
  const cols = (t: string) => new Set(Array.from(query(`PRAGMA table_info("${t.replace(/"/g, "")}")`), (r) => String(r.name)));
  const find = (re: RegExp) => tables.find((t) => re.test(t));
  const pick = (c: Set<string>, ...names: string[]) => names.find((n) => c.has(n)) ?? null;
  const since = opts.sinceDay ?? "0000-00-00";
  // Only rows from (a day before) `sinceDay` are read; the day check below is exact.
  const cutoff = opts.sinceDay ? Date.parse(`${opts.sinceDay}T00:00:00Z`) - 2 * 864e5 : null;
  const after = (col: string) => (cutoff == null ? "" : ` WHERE "${col}" >= ${cutoff}`);
  const days = new Map<string, HcDay>();
  const get = (d: string) => days.get(d) ?? (days.set(d, { day: d }), days.get(d)!);
  const found: string[] = [];
  const missing: string[] = [];
  const num = (v: unknown) => (v == null ? null : Number(v));

  /** Sums a per-record value per day and per app, then keeps the biggest app per day. */
  const perDayMaxApp = (table: string, valueCol: string, timeCol: string, offCol: string | null, appCol: string | null) => {
    const rows = query(`SELECT "${valueCol}" AS v, "${timeCol}" AS t${offCol ? `, "${offCol}" AS o` : ""}${appCol ? `, "${appCol}" AS a` : ""} FROM "${table}"${after(timeCol)}`);
    const byDay = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const t = num(r.t);
      const v = num(r.v);
      if (t == null || v == null || !Number.isFinite(v)) continue;
      const d = dayOf(t, num(r.o), tz);
      if (d < since) continue;
      const apps = byDay.get(d) ?? new Map<string, number>();
      const a = String(r.a ?? "");
      apps.set(a, (apps.get(a) ?? 0) + v);
      byDay.set(d, apps);
    }
    return new Map([...byDay].map(([d, apps]) => [d, Math.max(...apps.values())]));
  };

  // Steps.
  const st = find(/^steps_record/);
  if (st) {
    const c = cols(st);
    const v = pick(c, "count", "steps");
    const t = pick(c, "start_time", "time");
    if (v && t) {
      for (const [d, n] of perDayMaxApp(st, v, t, pick(c, "start_zone_offset", "zone_offset"), pick(c, "app_info_id", "app_id"))) if (n > 0) get(d).steps = Math.round(n);
      found.push("steps");
    }
  } else missing.push("steps");

  // Calories burned (total). Health Connect stores energy in small calories; switch to kcal when the numbers say so.
  const cal = find(/^total_calories_burned_record/) ?? find(/^active_calories_burned_record/);
  if (cal) {
    const c = cols(cal);
    const v = pick(c, "energy", "calories", "energy_kcal");
    const t = pick(c, "start_time", "time");
    if (v && t) {
      const sums = perDayMaxApp(cal, v, t, pick(c, "start_zone_offset", "zone_offset"), pick(c, "app_info_id", "app_id"));
      const vals = [...sums.values()].sort((a, b) => a - b);
      const median = vals[Math.floor(vals.length / 2)] ?? 0;
      const scale = median > 20000 ? 1 / 1000 : 1;
      for (const [d, n] of sums) if (n * scale > 0 && n * scale <= 20000) get(d).calories_burned = Math.round(n * scale);
      found.push("calories burned");
    }
  } else missing.push("calories burned");

  // Heart rate: average of all samples that day.
  const hrSeries = find(/^heart_rate_record_series/) ?? find(/^heart_rate_series/);
  if (hrSeries) {
    const c = cols(hrSeries);
    const v = pick(c, "beats_per_minute", "bpm");
    const t = pick(c, "epoch_millis", "time", "sample_time");
    if (v && t) {
      const acc = new Map<string, { s: number; n: number }>();
      // A band writes a sample every minute or so (millions of rows), so SQLite adds them up per
      // 15 minutes (every time zone's offset is a multiple of that) and only those are placed on days.
      const q = 900_000;
      const cond = `"${v}" BETWEEN 25 AND 230${cutoff == null ? "" : ` AND "${t}" >= ${cutoff}`}`;
      for (const r of query(`SELECT CAST("${t}" / ${q} AS INTEGER) AS b, SUM("${v}") AS s, COUNT(*) AS n FROM "${hrSeries}" WHERE ${cond} GROUP BY b`)) {
        const b = num(r.b);
        if (b == null) continue;
        const d = dayOf(b * q, null, tz);
        if (d < since) continue;
        const a = acc.get(d) ?? { s: 0, n: 0 };
        a.s += Number(r.s);
        a.n += Number(r.n);
        acc.set(d, a);
      }
      for (const [d, a] of acc) get(d).avg_hr = Math.round(a.s / a.n);
      found.push("heart rate");
    }
  } else missing.push("heart rate");

  // Resting heart rate: lowest reading that day.
  const rhr = find(/^resting_heart_rate_record/);
  if (rhr) {
    const c = cols(rhr);
    const v = pick(c, "beats_per_minute", "bpm");
    const t = pick(c, "time", "start_time");
    if (v && t) {
      const off = pick(c, "zone_offset", "start_zone_offset");
      for (const r of query(`SELECT "${v}" AS v, "${t}" AS t${off ? `, "${off}" AS o` : ""} FROM "${rhr}"${after(t)}`)) {
        const bpm = num(r.v);
        const ms = num(r.t);
        if (bpm == null || ms == null || bpm < 20 || bpm > 220) continue;
        const d = dayOf(ms, num(r.o), tz);
        if (d < since) continue;
        const cur = get(d).resting_hr;
        get(d).resting_hr = cur == null ? Math.round(bpm) : Math.min(cur, Math.round(bpm));
      }
      found.push("resting heart rate");
    }
  } else missing.push("resting heart rate");

  // HRV (RMSSD), average that day.
  const hrv = find(/^heart_rate_variability/);
  if (hrv) {
    const c = cols(hrv);
    const v = pick(c, "heart_rate_variability_millis", "rmssd", "value");
    const t = pick(c, "time", "start_time");
    if (v && t) {
      const acc = new Map<string, { s: number; n: number }>();
      for (const r of query(`SELECT "${v}" AS v, "${t}" AS t FROM "${hrv}"${after(t)}`)) {
        const x = num(r.v);
        const ms = num(r.t);
        if (x == null || ms == null || x <= 0 || x > 500) continue;
        const d = dayOf(ms, null, tz);
        if (d < since) continue;
        const a = acc.get(d) ?? { s: 0, n: 0 };
        a.s += x;
        a.n += 1;
        acc.set(d, a);
      }
      for (const [d, a] of acc) get(d).hrv_ms = Math.round(a.s / a.n);
      found.push("HRV");
    }
  }

  // Sleep: sessions counted on the day you woke up; deep sleep from stages (type 5 = deep).
  const sl = find(/^sleep_session_record/);
  if (sl) {
    const c = cols(sl);
    const s = pick(c, "start_time");
    const e = pick(c, "end_time");
    if (s && e) {
      const off = pick(c, "end_zone_offset", "zone_offset");
      const id = pick(c, "row_id", "id", "uuid");
      const app = pick(c, "app_info_id", "app_id");
      const sessions = query(`SELECT "${s}" AS s, "${e}" AS e${off ? `, "${off}" AS o` : ""}${id ? `, "${id}" AS id` : ""}${app ? `, "${app}" AS a` : ""} FROM "${sl}"${after(e)}`);
      const byDay = new Map<string, Map<string, number>>();
      const sessionDay = new Map<string, string>();
      for (const r of sessions) {
        const ms0 = num(r.s);
        const ms1 = num(r.e);
        if (ms0 == null || ms1 == null || ms1 <= ms0 || ms1 - ms0 > 20 * 60 * MIN) continue;
        const d = dayOf(ms1, num(r.o), tz);
        if (r.id != null) sessionDay.set(String(r.id), d);
        if (d < since) continue;
        const apps = byDay.get(d) ?? new Map<string, number>();
        const a = String(r.a ?? "");
        apps.set(a, (apps.get(a) ?? 0) + (ms1 - ms0) / MIN);
        byDay.set(d, apps);
      }
      for (const [d, apps] of byDay) get(d).sleep_minutes = Math.min(1440, Math.round(Math.max(...apps.values())));
      found.push("sleep");
      const stages = find(/^sleep_stages/);
      if (stages) {
        const sc = cols(stages);
        const ps = pick(sc, "parent_key", "session_id", "parent_id");
        const ss = pick(sc, "stage_start_time", "start_time");
        const se = pick(sc, "stage_end_time", "end_time");
        const ty = pick(sc, "stage_type", "type");
        if (ps && ss && se && ty) {
          const deep = new Map<string, number>();
          for (const r of query(`SELECT "${ps}" AS p, "${ss}" AS s, "${se}" AS e, "${ty}" AS ty FROM "${stages}"${after(se)}`)) {
            if (Number(r.ty) !== 5) continue;
            const d = sessionDay.get(String(r.p));
            const ms0 = num(r.s);
            const ms1 = num(r.e);
            if (!d || d < since || ms0 == null || ms1 == null || ms1 <= ms0) continue;
            deep.set(d, (deep.get(d) ?? 0) + (ms1 - ms0) / MIN);
          }
          for (const [d, m] of deep) get(d).deep_sleep_minutes = Math.min(get(d).sleep_minutes ?? 1440, Math.round(m));
          if (deep.size) found.push("deep sleep");
        }
      }
    }
  } else missing.push("sleep");

  // Active minutes: workout sessions that day.
  const ex = find(/^exercise_session_record/);
  if (ex) {
    const c = cols(ex);
    const s = pick(c, "start_time");
    const e = pick(c, "end_time");
    if (s && e) {
      const off = pick(c, "start_zone_offset", "zone_offset");
      const acc = new Map<string, number>();
      for (const r of query(`SELECT "${s}" AS s, "${e}" AS e${off ? `, "${off}" AS o` : ""} FROM "${ex}"${after(s)}`)) {
        const ms0 = num(r.s);
        const ms1 = num(r.e);
        if (ms0 == null || ms1 == null || ms1 <= ms0) continue;
        const d = dayOf(ms0, num(r.o), tz);
        if (d < since) continue;
        acc.set(d, (acc.get(d) ?? 0) + (ms1 - ms0) / MIN);
      }
      for (const [d, m] of acc) get(d).active_minutes = Math.min(1440, Math.round(m));
      found.push("workouts");
    }
  }

  // Weight (stored in grams by Health Connect).
  const weights: HcWeight[] = [];
  const wt = find(/^weight_record/);
  if (wt) {
    const c = cols(wt);
    const v = pick(c, "weight", "weight_kg", "mass");
    const t = pick(c, "time", "start_time");
    if (v && t) {
      const off = pick(c, "zone_offset", "start_zone_offset");
      for (const r of query(`SELECT "${v}" AS v, "${t}" AS t${off ? `, "${off}" AS o` : ""} FROM "${wt}"${after(t)} ORDER BY "${t}"`)) {
        const raw = num(r.v);
        const ms = num(r.t);
        if (raw == null || ms == null) continue;
        const kg = raw > 1000 ? raw / 1000 : raw;
        if (kg < 20 || kg > 350) continue;
        const d = dayOf(ms, num(r.o), tz);
        if (d < since) continue;
        weights.push({ day: d, at: new Date(ms).toISOString(), weight_kg: Math.round(kg * 10) / 10 });
      }
      if (weights.length) found.push("weight");
    }
  }

  return {
    days: [...days.values()].filter((d) => Object.keys(d).length > 1).sort((a, b) => a.day.localeCompare(b.day)),
    weights,
    found,
    missing,
    tables,
  };
}

/** The .db file inside an export zip (largest .db, in case there's more than one). */
export function pickDbEntry(names: string[]) {
  return names.filter((n) => /\.db$/i.test(n) && !n.startsWith("__MACOSX")).sort((a, b) => b.length - a.length)[0] ?? null;
}
