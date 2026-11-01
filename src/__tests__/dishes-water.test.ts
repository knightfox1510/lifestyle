import { describe, expect, it } from "vitest";
import { DISHES, DISH_BY_KEY, dishNutrition, dishPer100, searchDishes } from "@/modules/nutrition/dishes";
import { STAPLE_BY_KEY } from "@/modules/nutrition/staples";
import { IRRITANTS } from "@/modules/nutrition/irritants";
import { dueWaterSlot, waterExpectedBy, waterSlots } from "@/modules/notifications/timing";

describe("Indian dish library", () => {
  it("finds dishes by everyday and regional names", () => {
    expect(searchDishes("matki chi bhaji")[0].key).toBe("matki_usal");
    expect(searchDishes("dosa").map((d) => d.key)).toEqual(expect.arrayContaining(["plain_dosa", "masala_dosa"]));
    expect(searchDishes("pohe")[0].key).toBe("kanda_poha");
    expect(searchDishes("idly")[0].key).toBe("idli");
    expect(searchDishes("")).toEqual([]);
    expect(searchDishes("chi")).toEqual([]);
  });

  it("has unique keys, known staples and valid irritants", () => {
    expect(new Set(DISHES.map((d) => d.key)).size).toBe(DISHES.length);
    for (const d of DISHES) {
      expect(d.ingredients.length).toBeGreaterThan(0);
      for (const [k, g] of d.ingredients) {
        expect(STAPLE_BY_KEY[k], `${d.key}: ${k}`).toBeDefined();
        expect(g).toBeGreaterThan(0);
      }
      for (const i of d.irritants ?? []) expect(IRRITANTS).toContain(i);
    }
  });

  it("calculates plausible nutrition per serving", () => {
    for (const d of DISHES) {
      const n = dishNutrition(d);
      const kcalPer100 = ((n.calories ?? 0) * 100) / d.servingG;
      // Cooked dishes and drinks: between ~15 (chaas) and ~550 kcal per 100 g.
      expect(kcalPer100, d.key).toBeGreaterThan(15);
      expect(kcalPer100, d.key).toBeLessThan(550);
      expect(n.calories, d.key).toBeLessThan(900);
    }
    const dosa = dishNutrition(DISH_BY_KEY.plain_dosa);
    expect(dosa.calories).toBeGreaterThan(150);
    expect(dosa.calories).toBeLessThan(260);
    const matki = dishNutrition(DISH_BY_KEY.matki_usal);
    expect(matki.protein_g).toBeGreaterThan(7);
    expect(matki.iron_mg).toBeGreaterThan(1);
  });

  it("per-100 g values scale back to one serving", () => {
    const d = DISH_BY_KEY.kanda_poha;
    const per = dishPer100(d);
    expect(Math.abs(((per.calories ?? 0) * d.servingG) / 100 - (dishNutrition(d).calories ?? 0))).toBeLessThan(1);
  });
});

describe("water reminders", () => {
  it("builds slots from start to end", () => {
    expect(waterSlots("08:00", "12:00", 120)).toEqual([480, 600, 720]);
    expect(waterSlots("08:00:00", "19:30:00", 120).at(-1)).toBe(18 * 60);
    expect(waterSlots("20:00", "08:00", 60)).toEqual([]);
  });

  it("paces the target over the day", () => {
    // 08:00–20:00 every 2 h → 7 slots, span 14 h.
    expect(waterExpectedBy(480, "08:00", "20:00", 120, 2100)).toBe(300);
    expect(waterExpectedBy(1200, "08:00", "20:00", 120, 2100)).toBe(2100);
  });

  const base = { start: "08:00", end: "20:00", interval: 120, target: 2100, minutesSinceLastDrink: null };
  it("reminds only when behind, on a slot", () => {
    expect(dueWaterSlot({ ...base, now: "10:05", drunkMl: 0 })).toEqual({ slot: 600, expected: 600 });
    expect(dueWaterSlot({ ...base, now: "10:05", drunkMl: 700 })).toBeNull();
    expect(dueWaterSlot({ ...base, now: "11:00", drunkMl: 0 })).toBeNull();
    expect(dueWaterSlot({ ...base, now: "21:00", drunkMl: 0 })).toBeNull();
  });

  it("skips after a recent drink or once the target is met", () => {
    expect(dueWaterSlot({ ...base, now: "10:05", drunkMl: 0, minutesSinceLastDrink: 20 })).toBeNull();
    expect(dueWaterSlot({ ...base, now: "10:05", drunkMl: 0, minutesSinceLastDrink: 90 })).not.toBeNull();
    expect(dueWaterSlot({ ...base, now: "18:00", drunkMl: 2100 })).toBeNull();
  });
});
