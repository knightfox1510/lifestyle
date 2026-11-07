/**
 * Household measures → grams of edible food (pure; unit-tested).
 *
 * Food data is per 100 g of the EDIBLE part (no peel, seeds, core, shell or
 * bone). So:
 *  - ml use the food's density (milk 1.03 g/ml, oil 0.92, honey 1.42…);
 *  - katori/cup/spoons of a dry food (atta, rice, sugar, oats) use how much
 *    of it fits, which is far less than water;
 *  - "pieces" use a typical edible weight of one medium piece;
 *  - "weighed whole" removes the inedible share (a banana is ~36% peel).
 * Values: USDA FoodData Central household weights and refuse, rounded.
 */

export type MeasureMeta = {
  /** Edible grams of one medium piece, and what a piece is called. */
  piece?: { g: number; label: string };
  /** Inedible share when weighed whole (peel, seeds, core, shell, bone), 0–1. */
  refuse?: number;
  /** Grams per ml (liquids) or per ml of volume when spooned/poured (dry foods). */
  density?: number;
};

const META: Record<string, MeasureMeta> = {
  // Fruits: piece = edible weight of one medium fruit.
  banana: { piece: { g: 118, label: "medium banana" }, refuse: 0.36 },
  apple: { piece: { g: 182, label: "medium apple" }, refuse: 0.1 },
  mango: { piece: { g: 200, label: "medium mango (flesh)" }, refuse: 0.31 },
  orange: { piece: { g: 131, label: "medium orange" }, refuse: 0.27 },
  mosambi: { piece: { g: 150, label: "medium mosambi" }, refuse: 0.3 },
  guava: { piece: { g: 100, label: "medium guava" }, refuse: 0.05 },
  papaya: { piece: { g: 145, label: "cup of cubes" }, refuse: 0.33 },
  pomegranate: { piece: { g: 174, label: "cup of seeds" }, refuse: 0.44 },
  watermelon: { piece: { g: 152, label: "cup of cubes" }, refuse: 0.48 },
  muskmelon: { piece: { g: 160, label: "cup of cubes" }, refuse: 0.49 },
  grapes: { piece: { g: 5, label: "grape" }, refuse: 0.04 },
  pineapple: { piece: { g: 165, label: "cup of chunks" }, refuse: 0.49 },
  chikoo: { piece: { g: 100, label: "chikoo" }, refuse: 0.2 },
  pear: { piece: { g: 178, label: "medium pear" }, refuse: 0.1 },
  custard_apple: { piece: { g: 120, label: "sitaphal (flesh)" }, refuse: 0.45 },
  jackfruit: { piece: { g: 15, label: "bulb" }, refuse: 0.72 },
  strawberry: { piece: { g: 12, label: "strawberry" }, refuse: 0.06 },
  kiwi: { piece: { g: 69, label: "kiwi" }, refuse: 0.14 },
  litchi: { piece: { g: 10, label: "litchi" }, refuse: 0.4 },
  plum: { piece: { g: 66, label: "plum" }, refuse: 0.06 },
  peach: { piece: { g: 150, label: "peach" }, refuse: 0.04 },
  fig_fresh: { piece: { g: 50, label: "fig" }, refuse: 0.01 },
  amla: { piece: { g: 25, label: "amla" }, refuse: 0.1 },
  jamun: { piece: { g: 4, label: "jamun" }, refuse: 0.25 },
  avocado: { piece: { g: 136, label: "avocado (flesh)" }, refuse: 0.26 },
  dates: { piece: { g: 7, label: "date (pitted)" }, refuse: 0.1 },
  fig_dried: { piece: { g: 8, label: "dried anjeer" } },
  apricot_dried: { piece: { g: 7, label: "dried apricot" } },
  coconut_fresh: { refuse: 0.48 },
  // Vegetables.
  onion: { piece: { g: 110, label: "medium onion" }, refuse: 0.1 },
  tomato: { piece: { g: 123, label: "medium tomato" }, refuse: 0.09 },
  potato: { piece: { g: 150, label: "medium potato" }, refuse: 0.13 },
  carrot: { piece: { g: 61, label: "medium carrot" }, refuse: 0.11 },
  cucumber: { piece: { g: 200, label: "medium cucumber" }, refuse: 0.05 },
  capsicum: { piece: { g: 120, label: "medium capsicum" }, refuse: 0.18 },
  capsicum_red: { piece: { g: 120, label: "medium capsicum" }, refuse: 0.18 },
  brinjal: { piece: { g: 80, label: "small brinjal" }, refuse: 0.19 },
  green_chilli: { piece: { g: 4, label: "green chilli" }, refuse: 0.27 },
  garlic: { piece: { g: 3, label: "clove" }, refuse: 0.13 },
  sweet_potato: { piece: { g: 130, label: "medium sweet potato" }, refuse: 0.28 },
  corn: { piece: { g: 90, label: "cob (kernels)" }, refuse: 0.6 },
  drumstick: { piece: { g: 30, label: "drumstick pod" }, refuse: 0.5 },
  lemon_juice: { piece: { g: 30, label: "lemon (juice)" } },
  // Eggs, bread and pieces of things.
  egg: { piece: { g: 50, label: "egg" }, refuse: 0.12 },
  egg_white: { piece: { g: 33, label: "egg white" } },
  bread_white: { piece: { g: 30, label: "slice / pav" } },
  bread_brown: { piece: { g: 30, label: "slice" } },
  almonds: { piece: { g: 1.2, label: "almond" } },
  cashews: { piece: { g: 1.6, label: "cashew" } },
  walnuts: { piece: { g: 4, label: "walnut half" } },
  pistachios: { piece: { g: 0.7, label: "pistachio" }, refuse: 0.5 },
  peanuts: { refuse: 0.27 },
  biscuit_marie: { piece: { g: 7, label: "biscuit" } },
  cheese: { piece: { g: 20, label: "slice" } },
  papad: { piece: { g: 12, label: "papad" } },
  chicken_curry_cut: { piece: { g: 60, label: "curry-cut piece (meat)" }, refuse: 0.3 },
  mutton: { refuse: 0.25 },
  fish_lean: { refuse: 0.4 },
  fish_oily: { refuse: 0.4 },
  prawns: { refuse: 0.5 },
  // Liquids and pourable foods: g per ml.
  milk_whole: { density: 1.03 },
  milk_toned: { density: 1.03 },
  milk_double_toned: { density: 1.03 },
  milk_skim: { density: 1.03 },
  milk_buffalo: { density: 1.03 },
  buttermilk: { density: 1.02 },
  curd: { density: 1.03 },
  greek_yogurt: { density: 1.05 },
  cream: { density: 1 },
  soy_milk: { density: 1.03 },
  oat_milk: { density: 1.03 },
  almond_milk: { density: 1.03 },
  coconut_milk: { density: 0.97 },
  coconut_water: { density: 1.02 },
  ghee: { density: 0.91 },
  butter: { density: 0.96 },
  oil_sunflower: { density: 0.92 },
  oil_mustard: { density: 0.92 },
  oil_groundnut: { density: 0.92 },
  oil_coconut: { density: 0.92 },
  oil_olive: { density: 0.92 },
  honey: { density: 1.42 },
  ketchup: { density: 1.15 },
  mayonnaise: { density: 0.92 },
  cola: { density: 1.04 },
  juice_orange: { density: 1.04 },
  sugarcane_juice: { density: 1.06 },
  beer: { density: 1.01 },
  wine: { density: 0.99 },
  spirits: { density: 0.94 },
  // Dry foods by volume: grams that fit in 1 ml when spooned (1 cup = 240 ml).
  atta: { density: 0.5 },
  maida: { density: 0.52 },
  besan: { density: 0.38 },
  rice_flour: { density: 0.66 },
  rava: { density: 0.71 },
  rice_white: { density: 0.79 },
  rice_brown: { density: 0.79 },
  rice_cooked: { density: 0.66 },
  oats: { density: 0.34 },
  poha: { density: 0.3 },
  puffed_rice: { density: 0.06 },
  sugar: { density: 0.84 },
  jaggery: { density: 0.9 },
  salt: { density: 1.2 },
  toor: { density: 0.8 },
  moong: { density: 0.8 },
  masoor: { density: 0.8 },
  chana: { density: 0.8 },
  urad: { density: 0.8 },
  rajma: { density: 0.75 },
  sabudana: { density: 0.75 },
  peanut_butter: { density: 1.07 },
  chia: { density: 0.68 },
  flax: { density: 0.6 },
  sesame: { density: 0.6 },
  red_chilli_powder: { density: 0.5 },
  makhana: { density: 0.06 },
  cornflakes: { density: 0.12 },
  muesli: { density: 0.35 },
};

export function measureMeta(stapleKey: string | null | undefined): MeasureMeta {
  return (stapleKey && META[stapleKey]) || {};
}

/** Volume of each household measure in ml. 1 katori is a standard 150 ml bowl. */
export const VOLUME_ML = { tsp: 5, tbsp: 15, katori: 150, cup: 240, glass: 250 } as const;

export type Unit = { key: string; label: string; grams: number; note?: string };

/**
 * The ways to measure a food, each as grams of edible food per 1 unit.
 * `servingG` comes from a label or dish; `liquid` marks foods poured by ml
 * when there's no known density (assumed 1 g/ml).
 */
export function unitsFor(opts: { stapleKey?: string | null; servingG?: number | null; servingLabel?: string | null; liquid?: boolean }): Unit[] {
  const m = measureMeta(opts.stapleKey);
  const density = m.density ?? (opts.liquid ? 1 : null);
  const units: Unit[] = [{ key: "g", label: "grams", grams: 1 }];
  if (opts.servingG) units.push({ key: "serving", label: opts.servingLabel ? `servings (${opts.servingLabel})` : `servings (${opts.servingG} g)`, grams: opts.servingG });
  if (m.piece) units.push({ key: "piece", label: `${m.piece.label} (≈${m.piece.g} g)`, grams: m.piece.g });
  if (m.refuse) units.push({ key: "whole_g", label: "grams, weighed whole", grams: 1 - m.refuse, note: `${Math.round(m.refuse * 100)}% is peel, seeds, shell or bone and isn't counted` });
  // Volume measures are offered for liquids and pourable/spoonable foods, and for cooked dishes (katori/cup at ~1 g/ml).
  const d = density ?? 1;
  units.push({ key: "ml", label: "ml", grams: d });
  for (const [k, ml] of Object.entries(VOLUME_ML)) units.push({ key: k, label: `${k} (${ml} ml${d !== 1 ? ` ≈ ${Math.round(ml * d)} g` : ""})`, grams: ml * d });
  return units;
}

/** Grams of edible food for an amount in a unit. */
export function toGrams(amount: number, unit: Unit) {
  return Math.round(Math.max(0, amount) * unit.grams * 10) / 10;
}

/** The same rules, written out for the AI that turns "1 banana, a glass of milk" into grams. */
/** `only`: limit the per-food rules to these staple keys (a typed meal needs only its own foods). */
export function measureRulesForAi(only?: Set<string>) {
  const entries = Object.entries(META).filter(([k]) => !only || only.has(k));
  const refuse = entries
    .filter(([, m]) => m.refuse)
    .map(([k, m]) => `${k} ${Math.round(m.refuse! * 100)}%`)
    .join(", ");
  const pieces = entries
    .filter(([, m]) => m.piece)
    .map(([k, m]) => `${k}: 1 ${m.piece!.label} = ${m.piece!.g} g`)
    .join("; ");
  const dens = entries
    .filter(([, m]) => m.density && m.density !== 1)
    .map(([k, m]) => `${k} ${m.density}`)
    .join(", ");
  return `Grams are always the EDIBLE part (no peel, seeds, core, shell or bone).
${refuse ? `- If a weight is given for the whole fruit/vegetable/egg/meat with its inedible part, subtract this share: ${refuse}.\n` : ""}${pieces ? `- Typical edible weight of one piece: ${pieces}.\n` : ""}- ml → grams uses the food's density (g per ml; spooned dry foods by volume)${dens ? `: ${dens}` : ""}. 1 tsp = 5 ml, 1 tbsp = 15 ml, 1 katori = 150 ml, 1 cup = 240 ml, 1 glass = 250 ml.`;
}
