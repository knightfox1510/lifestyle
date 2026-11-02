import { describe, expect, it } from "vitest";
import { matchDish, portionOptions, scaleDish } from "@/modules/dining/menu";
import { mealCalcSchema, menuExtractSchema } from "@/lib/ai/phase2-schemas";
import { clampToSchema, medicalExtractionSchema, toGeminiSchema } from "@/lib/ai/schemas";

const dishes = [
  { id: "1", name: "Smash Burger" },
  { id: "2", name: "Double Smash Burger" },
  { id: "3", name: "Peri Peri Fries" },
  { id: "4", name: "Paneer Tikka (6 pcs)" },
];

describe("dish matching", () => {
  it("prefers exact (normalised) names", () => {
    expect(matchDish("smash burger", dishes)?.id).toBe("1");
    expect(matchDish("Double Smash Burger", dishes)?.id).toBe("2");
  });
  it("falls back to loose matches and ignores quantities", () => {
    expect(matchDish("Peri-Peri Fries (large)", dishes)?.id).toBe("3");
    expect(matchDish("paneer tikka", dishes)?.id).toBe("4");
  });
  it("returns nothing for unknown dishes", () => {
    expect(matchDish("Margherita Pizza", dishes)).toBeUndefined();
    expect(matchDish("", dishes)).toBeUndefined();
  });
});

describe("portions", () => {
  it("offers full, half, shares and double", () => {
    const p = portionOptions();
    expect(p.map((x) => x.key)).toEqual(["full", "half", "share2", "share3", "share4", "double"]);
    expect(p.find((x) => x.key === "share3")?.factor).toBeCloseTo(1 / 3);
  });
  it("scales nutrition and labels the portion", () => {
    const d = { name: "Smash Burger", calories: 780, protein_g: 38, carbs_g: 45, fat_g: 42 };
    expect(scaleDish(d, 1, "Good Flippin")).toEqual({ description: "Smash Burger (Good Flippin)", quantity: null, calories: 780, protein_g: 38, carbs_g: 45, fat_g: 42, fiber_g: 0 });
    expect(scaleDish(d, 0.5)).toMatchObject({ quantity: "half", calories: 390, protein_g: 19 });
    expect(scaleDish(d, 1 / 3)).toMatchObject({ quantity: "1/3 share", calories: 260 });
    expect(scaleDish({ ...d, calories: null, protein_g: null }, 2)).toMatchObject({ quantity: "2 portions", calories: 0, protein_g: 0 });
  });
});

describe("menu extraction schema", () => {
  it("validates a typical AI response", () => {
    const ok = menuExtractSchema.safeParse({
      restaurant_name: "Good Flippin' Burgers",
      items: [{ section: "Burgers", name: "Smash Burger", description: null, price: 349, veg: false, serves: 1, calories: 780, protein_g: 38, carbs_g: 45, fat_g: 42 }],
      note: null,
    });
    expect(ok.success).toBe(true);
  });
  it("produces a Gemini-friendly JSON schema (no $ref / oneOf)", () => {
    const json = JSON.stringify(toGeminiSchema(menuExtractSchema));
    expect(json).not.toMatch(/"\$ref"|"oneOf"|"allOf"/);
    expect(json).toContain("restaurant_name");
  });
  it("leaves out array item limits, which Gemini rejects with a 400", () => {
    for (const s of [menuExtractSchema, mealCalcSchema, medicalExtractionSchema]) {
      const json = JSON.stringify(toGeminiSchema(s));
      expect(json).not.toMatch(/"(max|min)Items"/);
    }
    expect(JSON.stringify(toGeminiSchema(mealCalcSchema))).toContain("At most 15 items.");
  });
  it("trims over-long AI lists back to the schema's limits", () => {
    const answer = { meal: "lunch", items: Array.from({ length: 20 }, () => ({ components: Array(30).fill({}), irritants: Array(12).fill("spicy") })), note: null };
    const out = clampToSchema(answer, mealCalcSchema);
    expect(out.items).toHaveLength(15);
    expect(out.items[0].components).toHaveLength(15);
    expect(out.items[0].irritants).toHaveLength(8);
  });
});
