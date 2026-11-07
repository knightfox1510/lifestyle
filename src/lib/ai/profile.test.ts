import { describe, expect, it } from "vitest";
import { estimateUsd, priceFamily, profileFor } from "./profile";

describe("AI cost profile", () => {
  it("knows each feature's weight", () => {
    expect(profileFor("food_estimate")).toMatchObject({ thinking: "low", media: "medium" });
    expect(profileFor("coach").deep).toBe(true);
    expect(profileFor("something_new")).toMatchObject({ thinking: "low", label: "something new" });
  });
  it("prices by model, counting thinking as output and cached input at 10%", () => {
    expect(priceFamily("gemini-pro-latest")).toBe("pro");
    expect(priceFamily("gemini-flash-lite-latest")).toBe("lite");
    expect(priceFamily(null)).toBe("flash");
    // Flash: 10k in ($0.005) + 1k out + 2k thinking ($0.009)
    expect(estimateUsd({ model: "gemini-flash-latest", input_tokens: 10_000, output_tokens: 1000, thinking_tokens: 2000 })).toBeCloseTo(0.014, 6);
    // Half the input cached: 5k full + 5k at 10%.
    expect(estimateUsd({ model: "gemini-flash-latest", input_tokens: 10_000, cached_tokens: 5000 })).toBeCloseTo(0.00275, 6);
    expect(estimateUsd({ model: "gemini-pro-latest", input_tokens: 1000, search_queries: 2 })).toBeCloseTo(0.002 + 0.028, 6);
    // Batch mode is half price.
    expect(estimateUsd({ model: "gemini-flash-latest", input_tokens: 10_000, batch: true })).toBeCloseTo(0.0025, 6);
  });
});
