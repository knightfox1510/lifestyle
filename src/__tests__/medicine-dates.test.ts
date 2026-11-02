import { describe, expect, it } from "vitest";
import { isCurrentOn, isUpcomingOn, slotsForDay } from "@/modules/medicines/logic";
import type { Medicine } from "@/lib/types";

const med = (extra: Partial<Medicine>): Medicine =>
  ({ id: "m1", name: "Bospi", active: true, times: ["09:00"], days_of_week: null, start_date: "2026-11-08", end_date: "2026-11-20", ...extra }) as Medicine;

describe("medicine dates", () => {
  it("a course starting later isn't due, current or listed as needed before its start", () => {
    expect(slotsForDay([med({})], [], "2026-11-02")).toEqual([]);
    expect(isCurrentOn(med({ times: [] }), "2026-11-02")).toBe(false);
    expect(isUpcomingOn(med({}), "2026-11-02")).toBe(true);
    expect(slotsForDay([med({})], [], "2026-11-08")).toHaveLength(1);
    expect(isCurrentOn(med({}), "2026-11-21")).toBe(false);
    expect(isCurrentOn(med({ active: false }), "2026-11-10")).toBe(false);
  });
});

import { medicineDoseNutrients } from "@/modules/medicines/nutrients";
import { checkMedicines, unrecognised } from "@/modules/medicines/checks";

describe("medicine nutrients", () => {
  it("adds per-unit nutrients for each taken dose, times units per dose", () => {
    const out = medicineDoseNutrients(
      [
        { id: "shelcal", dose_amount: 1, nutrients: { calcium_mg: 500, vit_d_mcg: 6.25 } },
        { id: "orofer", dose_amount: 2, nutrients: { iron_mg: 100 } },
        { id: "mirago", dose_amount: 1, nutrients: {} },
      ],
      [
        { medicine_id: "shelcal", scheduled_date: "2026-11-02", status: "taken" },
        { medicine_id: "shelcal", scheduled_date: "2026-11-02", status: "taken" },
        { medicine_id: "shelcal", scheduled_date: "2026-11-01", status: "skipped" },
        { medicine_id: "orofer", scheduled_date: "2026-11-02", status: "taken" },
        { medicine_id: "mirago", scheduled_date: "2026-11-02", status: "taken" },
      ],
    );
    expect(out).toEqual({ "2026-11-02": { calcium_mg: 1000, vit_d_mcg: 12.5, iron_mg: 200 } });
  });
  it("uses the composition for safety checks when the brand is unknown", () => {
    const meds = [{ name: "Brandx", ingredients: "Pantoprazole 40 mg", kind: "medicine" as const, times: ["08:00"] }];
    expect(unrecognised(meds)).toEqual([]);
    expect(unrecognised([{ name: "Brandx", kind: "medicine" as const }])).toEqual(["Brandx"]);
    expect(Array.isArray(checkMedicines(meds))).toBe(true);
  });
});
