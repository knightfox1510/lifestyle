import { describe, expect, it } from "vitest";
import { NUTRIENT_KEYS } from "@/modules/nutrition/nutrients";
import { SUPPLEMENT_CATALOG, confidentCatalogMatch, iuToMcg, searchSupplementCatalog, supplementTotals } from "@/modules/nutrition/supplements";
import { restockDefaults } from "@/modules/pantry/match";

describe("supplement catalog", () => {
  it("converts IU the way labels need", () => {
    expect(iuToMcg("vit_d", 60000)).toBe(1500);
    expect(iuToMcg("vit_d", 1000)).toBe(25);
    expect(iuToMcg("vit_a", 5000)).toBe(1500);
  });
  it("only uses known nutrient keys with positive amounts", () => {
    for (const s of SUPPLEMENT_CATALOG) {
      for (const [k, v] of Object.entries(s.nutrients)) {
        expect(NUTRIENT_KEYS as readonly string[], `${s.key}:${k}`).toContain(k);
        expect(v, `${s.key}:${k}`).toBeGreaterThan(0);
      }
    }
  });
  it("finds common Indian products by brand or generic name", () => {
    expect(searchSupplementCatalog("Uprise D3 60K")[0].key).toBe("d3_60k");
    expect(searchSupplementCatalog("shelcal")[0].key).toBe("shelcal_500");
    expect(searchSupplementCatalog("methylcobalamin 1500")[0].key).toBe("b12_1500");
    expect(searchSupplementCatalog("")).toEqual([]);
  });
  it("auto-fills only on a confident match", () => {
    expect(confidentCatalogMatch("Shelcal 500")?.key).toBe("shelcal_500");
    expect(confidentCatalogMatch("Magnesium")).toBeNull();
    expect(confidentCatalogMatch("Grandma's tonic")).toBeNull();
  });
});

describe("supplement totals", () => {
  it("adds up the doses taken", () => {
    const d3 = SUPPLEMENT_CATALOG.find((s) => s.key === "d3_60k")!.nutrients;
    const cal = SUPPLEMENT_CATALOG.find((s) => s.key === "shelcal_500")!.nutrients;
    expect(supplementTotals([{ nutrients: d3 }, { nutrients: cal }, { nutrients: null }])).toEqual({ vit_d_mcg: 1506.25, calcium_mg: 500 });
    expect(supplementTotals([{ nutrients: { iron_mg: "x", zinc_mg: -1 } }])).toEqual({});
  });
});

describe("restock defaults", () => {
  it("puts bought items in a sensible place", () => {
    expect(restockDefaults("dairy")).toEqual({ location: "fridge", days: 5 });
    expect(restockDefaults("frozen").location).toBe("freezer");
    expect(restockDefaults("household")).toEqual({ location: "pantry", days: null });
  });
});
