import { describe, expect, it } from "vitest";
import { usageByFeature } from "./usage-report";

describe("AI usage report", () => {
  it("ranks features by estimated cost and counts cache hits apart", () => {
    const r = usageByFeature([
      { feature: "food_estimate", user_id: "a", created_at: "", model: "gemini-flash-latest", input_tokens: 6000, output_tokens: 500, thinking_tokens: 1500 },
      { feature: "food_estimate", user_id: "a", created_at: "", from_cache: true },
      { feature: "coach", user_id: "a", created_at: "", model: "gemini-pro-latest", input_tokens: 20000, output_tokens: 3000, thinking_tokens: 5000 },
    ]);
    expect(r.lines.map((l) => l.feature)).toEqual(["coach", "food_estimate"]);
    expect(r.lines[1]).toMatchObject({ requests: 1, cached: 1, avgIn: 6000, avgThinking: 1500 });
    expect(r.requests).toBe(2);
    expect(r.cached).toBe(1);
    expect(r.lines[0].share + r.lines[1].share).toBeCloseTo(1);
  });
});
