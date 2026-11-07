import { describe, expect, it } from "vitest";
import { knownFoods, mealParts } from "./known";

const recent = [
  { id: "1", description: "Roti", quantity: "2", calories: 210 },
  { id: "2", description: "Moong dal", quantity: "1 katori", calories: 180 },
  { id: "3", description: "Masala chai", quantity: null, calories: 90 },
];

describe("known foods", () => {
  it("splits a typed meal into parts", () => {
    expect(mealParts("2 roti, moong dal and salad")).toEqual(["2 roti", "moong dal", "salad"]);
  });
  it("logs again only when every part was had before", () => {
    expect(knownFoods("2 roti and moong dal", recent)?.map((r) => r.id)).toEqual(["1", "2"]);
    expect(knownFoods("Masala chai.", recent)?.map((r) => r.id)).toEqual(["3"]);
    expect(knownFoods("roti, moong dal, salad", recent)).toBeNull();
    expect(knownFoods("3 roti", recent)).toBeNull();
    expect(knownFoods("", recent)).toBeNull();
  });
});
