import type { Nutrients, NutrientKey } from "./nutrients";

/** Nutrients that supplements usually carry (per one dose), in the app's units. */
export const SUPPLEMENT_KEYS: NutrientKey[] = ["vit_d_mcg", "b12_mcg", "iron_mg", "calcium_mg", "folate_mcg", "zinc_mg", "magnesium_mg", "vit_c_mg", "vit_a_mcg", "calories", "protein_g"];

/** Labels print vitamin D and A in IU; the app uses µg (vitamin A as retinol activity equivalents). */
export function iuToMcg(kind: "vit_d" | "vit_a", iu: number) {
  return Math.round((kind === "vit_d" ? iu / 40 : iu * 0.3) * 100) / 100;
}

export type CatalogSupplement = { key: string; name: string; aliases: string; serving: string; weekly?: boolean; nutrients: Nutrients };

/**
 * Common supplements in India with typical amounts per dose. Formulations
 * change and brands differ: the UI says "check your label" and every value is editable.
 */
export const SUPPLEMENT_CATALOG: CatalogSupplement[] = [
  { key: "d3_60k", name: "Vitamin D3 60,000 IU (weekly)", aliases: "uprise d3 60k uprise-d3 calcirol d-rise 60k arachitol 60k tayo 60k vitamin d 60000 cholecalciferol sachet", serving: "1 sachet/capsule", weekly: true, nutrients: { vit_d_mcg: iuToMcg("vit_d", 60000) } },
  { key: "d3_2000", name: "Vitamin D3 2,000 IU", aliases: "vitamin d3 2000 iu d3 2000", serving: "1 tablet", nutrients: { vit_d_mcg: iuToMcg("vit_d", 2000) } },
  { key: "d3_1000", name: "Vitamin D3 1,000 IU", aliases: "vitamin d3 1000 iu d3 1000", serving: "1 tablet", nutrients: { vit_d_mcg: iuToMcg("vit_d", 1000) } },
  { key: "shelcal_500", name: "Calcium 500 mg + D3 250 IU (Shelcal 500 type)", aliases: "shelcal 500 shelcal calcium carbonate d3 cipcal 500 calcimax", serving: "1 tablet", nutrients: { calcium_mg: 500, vit_d_mcg: iuToMcg("vit_d", 250) } },
  { key: "shelcal_hd", name: "Calcium 500 mg + D3 1,000 IU (Shelcal HD type)", aliases: "shelcal hd calcium d3 1000", serving: "1 tablet", nutrients: { calcium_mg: 500, vit_d_mcg: iuToMcg("vit_d", 1000) } },
  { key: "b12_1500", name: "Methylcobalamin (B12) 1,500 mcg", aliases: "methylcobalamin 1500 mecobalamin nurokind methycobal b12 1500", serving: "1 tablet", nutrients: { b12_mcg: 1500 } },
  { key: "b12_500", name: "Methylcobalamin (B12) 500 mcg", aliases: "methylcobalamin 500 b12 500", serving: "1 tablet", nutrients: { b12_mcg: 500 } },
  { key: "neurobion_forte", name: "B-complex with B12 15 mcg (Neurobion Forte type)", aliases: "neurobion forte b complex", serving: "1 tablet", nutrients: { b12_mcg: 15 } },
  { key: "becosules", name: "B-complex + vitamin C 150 mg (Becosules type)", aliases: "becosules b complex vitamin c capsule", serving: "1 capsule", nutrients: { vit_c_mg: 150, b12_mcg: 15, folate_mcg: 1500 } },
  { key: "orofer_xt", name: "Iron 100 mg + folic acid 1.5 mg (Orofer XT type)", aliases: "orofer xt ferrous ascorbate iron folic acid", serving: "1 tablet", nutrients: { iron_mg: 100, folate_mcg: 1500 } },
  { key: "livogen", name: "Iron 50 mg + folic acid 1.5 mg (Livogen type)", aliases: "livogen ferrous fumarate iron folic", serving: "1 tablet", nutrients: { iron_mg: 50, folate_mcg: 1500 } },
  { key: "folic_5", name: "Folic acid 5 mg", aliases: "folic acid 5 mg folvite 5", serving: "1 tablet", nutrients: { folate_mcg: 5000 } },
  { key: "vit_c_500", name: "Vitamin C 500 mg (Limcee type)", aliases: "limcee vitamin c 500 celin chewable", serving: "1 tablet", nutrients: { vit_c_mg: 500 } },
  { key: "vit_c_1000", name: "Vitamin C 1,000 mg", aliases: "vitamin c 1000 effervescent", serving: "1 tablet", nutrients: { vit_c_mg: 1000 } },
  { key: "zinc_50", name: "Zinc 50 mg", aliases: "zinc 50 zinc sulphate zinc gluconate", serving: "1 tablet", nutrients: { zinc_mg: 50 } },
  { key: "mag_200", name: "Magnesium 200 mg (glycinate/citrate)", aliases: "magnesium glycinate magnesium citrate 200", serving: "1–2 capsules", nutrients: { magnesium_mg: 200 } },
  { key: "whey", name: "Whey protein (1 scoop, ~30 g)", aliases: "whey protein scoop isolate concentrate", serving: "1 scoop", nutrients: { calories: 120, protein_g: 24 } },
];

export function searchSupplementCatalog(query: string, limit = 6): CatalogSupplement[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  return SUPPLEMENT_CATALOG.map((s) => {
    const hay = `${s.name} ${s.aliases}`.toLowerCase();
    return { s, score: words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0) / words.length };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

/** Only a confident match (every word found) is applied automatically when a supplement is added by name. */
export function confidentCatalogMatch(name: string): CatalogSupplement | null {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  if (words.length < 2) return null;
  const hit = SUPPLEMENT_CATALOG.find((s) => words.every((w) => `${s.name} ${s.aliases}`.toLowerCase().includes(w)));
  return hit ?? null;
}

/** Sum of taken doses: one row per supplement taken on a day. */
export function supplementTotals(taken: { nutrients: Record<string, unknown> | null }[]): Nutrients {
  const out: Record<string, number> = {};
  for (const t of taken) {
    for (const [k, v] of Object.entries(t.nutrients ?? {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = Math.round(((out[k] ?? 0) + n) * 100) / 100;
    }
  }
  return out as Nutrients;
}
