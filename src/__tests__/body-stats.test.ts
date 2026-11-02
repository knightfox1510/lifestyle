import { describe, expect, it } from "vitest";
import { ageOn, bmi, bmiBand, bmr, healthyWeightRange, waistRisk, waistToHeight } from "@/modules/body/stats";

describe("body numbers", () => {
  it("uses Indian adult BMI cut-offs", () => {
    expect(bmi(70, 170)).toBe(24.2);
    expect(bmiBand(22.9)).toBe("healthy");
    expect(bmiBand(23)).toBe("over");
    expect(bmiBand(25)).toBe("obese");
    expect(bmiBand(18)).toBe("under");
  });
  it("gives a healthy weight range for a height", () => {
    expect(healthyWeightRange(160)).toEqual({ low: 47.4, high: 58.6 });
  });
  it("rates waist to height and the Indian waist cut-offs", () => {
    expect(waistToHeight(80, 165)).toEqual({ value: 0.48, band: "ok" });
    expect(waistToHeight(90, 160).band).toBe("raised");
    expect(waistRisk(85, "female")).toBe(true);
    expect(waistRisk(85, "male")).toBe(false);
    expect(waistRisk(85, null)).toBeNull();
  });
  it("works out age and resting calories", () => {
    expect(ageOn("1992-11-03", "2026-11-02")).toBe(33);
    expect(ageOn("1992-11-02", "2026-11-02")).toBe(34);
    expect(bmr(60, 160, 34, "female")).toBe(1269);
  });
});
