import { describe, expect, it } from "vitest";
import { coachFacts, factLines, slopePerDay } from "@/modules/coach/facts";
import { coachSchema } from "@/lib/ai/coach-schema";
import { toGeminiSchema } from "@/lib/ai/schemas";

const day = (i: number) => new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10); // 5 Oct + i
const person = { heightCm: 175, sex: "male" as const, age: 34, activity: "light" as const };

describe("AI coach facts", () => {
  it("weight trend per week from a noisy series", () => {
    // -0.1 kg/day = -0.7 kg/week, with ±0.3 noise.
    const pts = Array.from({ length: 28 }, (_, i) => ({ day: day(i), value: 85 - 0.1 * i + (i % 2 ? 0.3 : -0.3) }));
    expect(slopePerDay(pts)! * 7).toBeCloseTo(-0.7, 1);
    expect(slopePerDay(pts.slice(0, 2))).toBeNull();
  });

  it("energy balance: a flat scale with a big logged deficit means the log is missing food", () => {
    const f = coachFacts({
      today: day(27),
      from: day(0),
      person,
      food: {
        // 1,400 kcal logged every day, plus a forgotten-dinner day (500 kcal) that must not count.
        entries: [...Array.from({ length: 27 }, (_, i) => ({ day: day(i), hour: 13, description: "Dal rice", calories: 1400, protein_g: 50, carbs_g: 200, fat_g: 40, fiber_g: 20 })), { day: day(27), hour: 9, description: "Poha", calories: 500, protein_g: 10, carbs_g: 80, fat_g: 12, fiber_g: 3 }],
        goals: { calories: 1800, protein_g: 120, carbs_g: null, fat_g: null, fiber_g: null, goal: "lose", diet_type: "vegetarian" },
      },
      body: { metrics: Array.from({ length: 8 }, (_, i) => ({ day: day(i * 3), weight_kg: 82, waist_cm: i === 0 ? 94 : i === 7 ? 92 : null, body_fat_pct: null, bp_systolic: null, bp_diastolic: null, blood_glucose_mgdl: null, glucose_context: null })), goals: { target_weight_kg: 75, target_date: null, target_body_fat_pct: null } },
    });
    expect(f.food!.fullDays).toBe(27);
    expect(f.food!.avg.kcal).toBe(1400);
    expect(f.food!.proteinPerKg).toBe(0.6);
    expect(f.weight!.perWeek).toBe(0);
    expect(f.weight!.bmi).toBe(26.8);
    expect(f.waist).toEqual({ first: 94, latest: 92, change: -2 });
    expect(f.energy!.impliedBurn).toBe(1400);
    // Maintenance for 82 kg / 175 cm / 34 y male, light activity ≈ 2,450: the log is ~1,000 kcal short.
    expect(f.energy!.maintenance).toBeGreaterThan(2300);
    expect(f.energy!.gap).toBeLessThan(-800);
    expect(factLines(f).join("\n")).toMatch(/missed in the log/);
  });

  it("sleep from the band, and eating more after short nights", () => {
    const wear = Array.from({ length: 10 }, (_, i) => ({ day: day(i), steps: 6000 + i * 100, sleep_minutes: i < 5 ? 330 : 450, deep_sleep_minutes: 60, resting_hr: i < 5 ? 62 : 66, hrv_ms: i < 5 ? 45 : 38, active_minutes: 20, calories_burned: 2300 }));
    const entries = Array.from({ length: 10 }, (_, i) => ({ day: day(i), hour: i % 2 ? 22 : 13, description: "Thali", calories: i < 5 ? 2400 : 1900, protein_g: 70, carbs_g: 250, fat_g: 70, fiber_g: 25 }));
    const f = coachFacts({ today: day(9), from: day(0), person, wearables: wear, food: { entries, goals: null } });
    expect(f.sleep).toMatchObject({ source: "wearable", nights: 10, nightsUnder7: 5, deepMinutes: 60 });
    expect(f.sleepVsFood).toEqual({ shortSleepKcal: 2400, goodSleepKcal: 1900, shortNights: 5, goodNights: 5 });
    expect(f.heart).toMatchObject({ restingAvg: 64, restingChange: 4, hrvChange: -7 });
    expect(f.activity!.avgSteps).toBe(6450);
    expect(f.food!.lateKcalPct).toBe(Math.round((2400 * 2 + 1900 * 3) / (2400 * 5 + 1900 * 5) * 100));
  });

  it("only what's in the period and what was included", () => {
    const f = coachFacts({ today: day(9), from: day(5), person, workouts: [{ day: day(1), kind: "gym", title: "Old", status: "done", minutes: 60 }, { day: day(6), kind: "gym", title: "Legs", status: "done", minutes: 45 }, { day: day(7), kind: "yoga", title: "Yoga", status: "skipped", minutes: null }] });
    expect(f.food).toBeUndefined();
    expect(f.weight).toBeUndefined();
    expect(f.training).toMatchObject({ skipped: 1, byKind: { gym: 1 } });
  });

  it("the answer schema is one Gemini accepts (no item limits on object arrays)", () => {
    const s = JSON.stringify(toGeminiSchema(coachSchema));
    expect(s).not.toMatch(/"(maxItems|minItems)"/);
  });
});
