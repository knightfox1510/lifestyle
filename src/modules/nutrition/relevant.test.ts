import { describe, expect, it } from "vitest";
import { relevantFoods } from "./relevant";

describe("relevant foods for a typed meal", () => {
  it("finds dishes by regional names and the staples they use", () => {
    const r = relevantFoods("2 chapatis, matki chi bhaji and a bowl of pohe");
    const keys = r.dishes.map((d) => d.key);
    expect(keys).toContain("matki_usal");
    expect(keys.some((k) => k.includes("poha"))).toBe(true);
    expect(r.staples.has("atta")).toBe(true);
    expect(r.staples.has("matki")).toBe(true);
    // Core cooking ingredients are always there.
    expect(r.staples.has("oil_sunflower")).toBe(true);
    // Far fewer than everything.
    expect(r.staples.size).toBeLessThan(80);
  });
  it("matches plain foods and offers no dishes when none fit", () => {
    const r = relevantFoods("apple and almonds");
    expect(r.staples.has("apple")).toBe(true);
    expect(r.staples.has("almonds")).toBe(true);
    expect(r.dishes.length).toBeLessThan(5);
  });
});

describe("household names", () => {
  it("matches a saved recipe or food by a shared word", async () => {
    const { mentions } = await import("./relevant");
    expect(mentions("aai's dal and rice", "Aai's dal tadka")).toBe(true);
    expect(mentions("2 eggs", "Protein shake")).toBe(false);
  });
});
