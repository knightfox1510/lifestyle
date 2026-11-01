import { describe, expect, it } from "vitest";
import { daysUntil, inPantry, normalizeName } from "@/modules/pantry/match";
import { byMarker, computeFlag, refLabel } from "@/modules/medical/labs";
import { maintenanceCalories, mealForHour, totals } from "@/modules/food/meta";
import type { LabResult } from "@/lib/types";

describe("pantry matching", () => {
  it("normalises quantities, plurals and adjectives", () => {
    expect(normalizeName("2 Tomatoes")).toBe("tomato");
    expect(normalizeName("Fresh Paneer (200 g)")).toBe("paneer");
    expect(normalizeName("1 kg Onions")).toBe("onion");
  });
  it("matches ingredients to pantry items loosely", () => {
    const pantry = [{ name: "Amul paneer 200g", used_up_at: null }, { name: "Tomatoes", used_up_at: null }, { name: "Milk", used_up_at: "2026-01-01T00:00:00Z" }];
    expect(inPantry("paneer", pantry)).toBe(true);
    expect(inPantry("2 tomatoes", pantry)).toBe(true);
    expect(inPantry("milk", pantry)).toBe(false); // used up
    expect(inPantry("spinach", pantry)).toBe(false);
  });
  it("counts days until expiry", () => {
    expect(daysUntil("2026-11-04", "2026-11-01")).toBe(3);
    expect(daysUntil("2026-10-30", "2026-11-01")).toBe(-2);
    expect(daysUntil(null, "2026-11-01")).toBeNull();
  });
});

const lab = (over: Partial<LabResult>): LabResult => ({
  id: Math.random().toString(),
  owner_id: "u",
  document_id: null,
  test_date: "2026-01-01",
  panel: null,
  marker: "TSH",
  value: 2,
  value_text: null,
  unit: "µIU/mL",
  ref_low: 0.4,
  ref_high: 4,
  ref_text: null,
  flag: "normal",
  source: "manual",
  include_in_ai: true,
  ...over,
});

describe("lab results", () => {
  it("flags values against the range", () => {
    expect(computeFlag(18, 30, 100)).toBe("low");
    expect(computeFlag(6.1, null, 5.6)).toBe("high");
    expect(computeFlag(50, 30, 100)).toBe("normal");
    expect(computeFlag(5, null, null)).toBeNull();
    expect(computeFlag(null, 1, 2)).toBeNull();
  });
  it("labels reference ranges", () => {
    expect(refLabel({ ref_low: 30, ref_high: 100, ref_text: null })).toBe("30–100");
    expect(refLabel({ ref_low: null, ref_high: 150, ref_text: null })).toBe("< 150");
    expect(refLabel({ ref_low: 1, ref_high: 2, ref_text: "Negative" })).toBe("Negative");
  });
  it("groups by marker case-insensitively, newest first", () => {
    const groups = byMarker([
      lab({ marker: "TSH", test_date: "2025-06-01", value: 5.1 }),
      lab({ marker: "tsh ", test_date: "2026-01-01", value: 3.2 }),
      lab({ marker: "HbA1c", panel: "Diabetes", value: 5.4 }),
    ]);
    expect(groups).toHaveLength(2);
    const tsh = groups.find((g) => g[0].marker.trim().toLowerCase() === "tsh")!;
    expect(tsh.map((r) => r.value)).toEqual([3.2, 5.1]);
  });
});

describe("food helpers", () => {
  it("sums totals with nulls", () => {
    expect(totals([{ calories: 200, protein_g: 10.4, carbs_g: null, fat_g: 5, fiber_g: 1 }, { calories: null, protein_g: 5, carbs_g: 30, fat_g: null, fiber_g: null }])).toEqual({
      calories: 200,
      protein_g: 15,
      carbs_g: 30,
      fat_g: 5,
      fiber_g: 1,
    });
  });
  it("estimates maintenance calories (Mifflin–St Jeor)", () => {
    // 64 kg, 160 cm, 32 y female, moderate: (640 + 1000 - 160 - 161) * 1.55 = 2044.45
    expect(maintenanceCalories({ weightKg: 64, heightCm: 160, age: 32, sex: "female", activity: "moderate" })).toBe(2040);
  });
  it("guesses meal from hour", () => {
    expect(mealForHour(8)).toBe("breakfast");
    expect(mealForHour(13)).toBe("lunch");
    expect(mealForHour(17)).toBe("snack");
    expect(mealForHour(21)).toBe("dinner");
  });
});

describe("mealTimeOn", () => {
  it("uses the meal's usual local time in the person's timezone", async () => {
    const { mealTimeOn } = await import("@/modules/food/meta");
    const later = new Date("2030-01-01T00:00:00Z");
    expect(mealTimeOn("2026-11-05", "lunch", "Asia/Kolkata", later)).toBe("2026-11-05T08:00:00.000Z"); // 13:30 IST
    expect(mealTimeOn("2026-11-05", "breakfast", "Asia/Kolkata", later)).toBe("2026-11-05T03:00:00.000Z");
    expect(mealTimeOn("2026-07-01", "dinner", "Europe/London", later)).toBe("2026-07-01T19:30:00.000Z"); // BST
    expect(mealTimeOn("2026-11-05", "other", "UTC", later)).toBe("2026-11-05T11:00:00.000Z");
  });
  it("never returns a time after now", async () => {
    const { mealTimeOn } = await import("@/modules/food/meta");
    const now = new Date("2026-11-05T04:00:00Z"); // 09:30 IST
    expect(mealTimeOn("2026-11-05", "dinner", "Asia/Kolkata", now)).toBe(now.toISOString());
  });
});
