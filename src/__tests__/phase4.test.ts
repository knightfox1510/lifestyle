import { describe, expect, it } from "vitest";
import { parseWearableCsv } from "@/modules/wearables/csv";
import { nextOccurrence, occasionInfo, ordinal } from "@/modules/occasions/logic";
import type { Occasion } from "@/lib/types";

describe("wearable CSV import", () => {
  it("reads a Zepp ACTIVITY export", () => {
    const csv = "date,steps,distance,runDistance,calories\n2026-10-30,8123,5800,0,240\n2026-10-31,10450,7600,1200,310\n";
    const { rows, kind } = parseWearableCsv(csv);
    expect(kind).toBe("activity");
    expect(rows).toEqual([
      { day: "2026-10-30", steps: 8123, calories_burned: 240 },
      { day: "2026-10-31", steps: 10450, calories_burned: 310 },
    ]);
  });
  it("sums Zepp SLEEP stages into minutes", () => {
    const csv = "date,deepSleepTime,shallowSleepTime,wakeTime,start,stop,REMTime\n2026-10-31,80,250,10,x,y,70\n";
    const { rows, kind } = parseWearableCsv(csv);
    expect(kind).toBe("sleep");
    expect(rows[0]).toMatchObject({ day: "2026-10-31", sleep_minutes: 400, deep_sleep_minutes: 80 });
  });
  it("aggregates HEARTRATE_AUTO readings per day", () => {
    const lines = ["date,time,heartRate", ...Array.from({ length: 20 }, (_, i) => `2026-10-31,${String(i).padStart(2, "0")}:00,${55 + i * 2}`)];
    const { rows, kind } = parseWearableCsv(lines.join("\n"));
    expect(kind).toBe("heart rate");
    expect(rows[0].day).toBe("2026-10-31");
    expect(rows[0].avg_hr).toBe(74);
    expect(rows[0].resting_hr).toBe(56);
  });
  it("handles generic CSVs, dd/mm/yyyy dates, quotes and BOM", () => {
    const csv = '﻿Date,Steps,Sleep Minutes,Resting HR\n"01/11/2026","9,500",420,60\n';
    const { rows } = parseWearableCsv(csv);
    expect(rows).toEqual([{ day: "2026-11-01", steps: 9500, sleep_minutes: 420, resting_hr: 60 }]);
  });
  it("rejects files without a date column", () => {
    expect(parseWearableCsv("foo,bar\n1,2").rows).toEqual([]);
  });
});

const occ = (over: Partial<Occasion>): Occasion => ({
  id: "o",
  household_id: "h",
  title: "Birthday",
  kind: "birthday",
  month: 3,
  day: 14,
  year: 1996,
  recurring: true,
  person: null,
  remind_days_before: 7,
  notes: null,
  ...over,
});

describe("occasions", () => {
  it("finds the next yearly occurrence", () => {
    expect(nextOccurrence(occ({}), "2026-11-01")).toBe("2027-03-14");
    expect(nextOccurrence(occ({ month: 11, day: 1 }), "2026-11-01")).toBe("2026-11-01");
    expect(nextOccurrence(occ({ month: 2, day: 29 }), "2026-11-01")).toBe("2027-02-28");
    expect(nextOccurrence(occ({ recurring: false, year: 2026, month: 1, day: 1 }), "2026-11-01")).toBeNull();
  });
  it("labels ages and anniversaries", () => {
    expect(occasionInfo(occ({}), "2026-11-01")).toMatchObject({ next: "2027-03-14", label: "turns 31" });
    expect(occasionInfo(occ({ kind: "anniversary", year: 2021, month: 12, day: 1 }), "2026-11-01")).toMatchObject({ inDays: 30, label: "5th anniversary" });
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
  });
});
