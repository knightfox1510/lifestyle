import { describe, expect, it } from "vitest";
import { foodEmoji } from "@/modules/food/emoji";

describe("food emoji", () => {
  it.each([
    ["Masala chai (1 cup)", "🍵"],
    ["Chicken biryani", "🍚"],
    ["2 rotis with ghee", "🫓"],
    ["Dal tadka", "🍛"],
    ["Paneer bhurji", "🧀"],
    ["Poha", "🥣"],
    ["Banana", "🍌"],
    ["Vada pav", "🍔"],
    ["Something unusual", "🍽️"],
  ])("%s → %s", (d, e) => expect(foodEmoji(d)).toBe(e));
});
