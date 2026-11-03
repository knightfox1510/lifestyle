import { describe, expect, it } from "vitest";
import { plausibleKcal, rankUsda, usdaScore } from "@/modules/nutrition/usda-rank";
import { STAPLE_BY_KEY, searchStaples } from "@/modules/nutrition/staples";

describe("food matching", () => {
  it("puts the plain food ahead of things made from it", () => {
    const foods = [{ name: "Pastry, Pastelitos de Guava (guava pastries)" }, { name: "Guava nectar, canned" }, { name: "Guavas, common, raw" }, { name: "Guava sauce, cooked" }];
    expect(rankUsda("pink guava", foods)[0].name).toBe("Guavas, common, raw");
    expect(rankUsda("guava juice", [{ name: "Guavas, common, raw" }, { name: "Guava juice" }])[0].name).toBe("Guava juice");
    expect(usdaScore("almond milk", "Beverages, almond milk, unsweetened, shelf stable")).toBeGreaterThan(usdaScore("almond milk", "Beverages, almond milk, chocolate, ready-to-drink"));
  });
  it("rejects a match that's way off the AI's own estimate", () => {
    expect(plausibleKcal(379, 68)).toBe(false); // guava pastry vs guava
    expect(plausibleKcal(68, 60)).toBe(true);
    expect(plausibleKcal(15, 30)).toBe(true); // light foods get slack
    expect(plausibleKcal(379, null)).toBe(true); // no estimate: can't judge
  });
  it("knows common Indian fruits", () => {
    expect(STAPLE_BY_KEY.guava.per100.calories).toBe(68);
    expect(searchStaples("pink guava")[0].key).toBe("guava");
    expect(searchStaples("chiku")[0]?.key).toBe("chikoo");
    expect(searchStaples("sitaphal")[0].key).toBe("custard_apple");
  });
});
