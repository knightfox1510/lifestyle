import type { Nutrients } from "./nutrients";
import type { Irritant } from "./irritants";

/**
 * Common Indian kitchen staples, per 100 g (raw unless stated). Approximate
 * values from USDA FoodData Central (SR Legacy) and IFCT averages. Unknown
 * micronutrients are left out rather than guessed. For anything not here,
 * search USDA or save your own food from its label.
 */
type Row = [key: string, name: string, aliases: string, n: (number | null)[], irritants?: Irritant[]];

// Order of values: kcal, protein, carbs, fat, fibre, sugar, sat fat, Na, K, Ca, Fe, Mg, Zn, vit A (RAE µg), vit C, vit D (µg), B12 (µg), folate (µg)
const ROWS: Row[] = [
  ["rice_white", "Rice, white (raw)", "chawal basmati sona masoori", [365, 7.1, 80, 0.7, 1.3, 0.1, 0.2, 5, 115, 28, 0.8, 25, 1.1, 0, 0, 0, 0, 8]],
  ["rice_brown", "Rice, brown (raw)", "brown rice", [367, 7.5, 76, 3.2, 3.6, 0.9, 0.6, 4, 250, 9, 1.5, 116, 2.1, 0, 0, 0, 0, 20]],
  ["rice_cooked", "Rice, white (cooked)", "cooked rice steamed rice", [130, 2.7, 28, 0.3, 0.4, 0.1, 0.1, 1, 35, 10, 0.2, 12, 0.5, 0, 0, 0, 0, 3]],
  ["atta", "Whole wheat flour (atta)", "atta roti chapati phulka paratha wheat flour", [340, 13.2, 72, 2.5, 10.7, 0.4, 0.4, 2, 363, 34, 3.6, 137, 2.6, 0, 0, 0, 0, 44]],
  ["maida", "Refined flour (maida)", "maida all-purpose flour", [364, 10.3, 76, 1, 2.7, 0.3, 0.2, 2, 107, 15, 1.2, 22, 0.7, 0, 0, 0, 0, 26]],
  ["besan", "Gram flour (besan)", "besan chickpea flour", [387, 22.4, 58, 6.7, 10.8, 10.9, 0.7, 64, 846, 45, 4.9, 166, 2.8, 2, 0, 0, 0, 437]],
  ["oats", "Oats, rolled", "oats oatmeal", [379, 13.2, 68, 6.5, 10.1, 1, 1.1, 6, 362, 52, 4.3, 138, 3.6, 0, 0, 0, 0, 32]],
  ["rava", "Semolina (rava / suji)", "rava suji sooji semolina upma", [360, 12.7, 73, 1.1, 3.9, null, 0.2, 1, 186, 17, 1.2, 47, 1.1, 0, 0, 0, 0, 72]],
  ["ragi", "Finger millet flour (ragi)", "ragi nachni finger millet", [320, 7.2, 67, 1.9, 11.2, null, null, null, null, 364, 4.6, null, null, null, null, 0, 0, null]],
  ["matki", "Moth beans / matki (raw)", "matki moth math mataki usal", [343, 22.9, 61.5, 1.6, null, null, 0.4, 30, 1191, 150, 10.9, 381, 1.9, 2, 4, 0, 0, 649]],
  ["sabudana", "Sago / tapioca pearls (sabudana)", "sabudana sago tapioca", [358, 0.2, 88.7, 0, 0.9, 3.4, 0, 1, 11, 20, 1.6, 1, 0.1, 0, 0, 0, 0, 4]],
  ["poha", "Flattened rice (poha)", "poha pohe aval chivda flattened beaten rice", [346, 6.6, 77, 1.2, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, null]],
  ["jowar", "Sorghum flour (jowar)", "jowar jwari sorghum bhakri", [359, 8.4, 76.6, 3.3, 6.6, 1.9, 0.6, 3, 287, 12, 3.1, 123, 1.6, 0, 0, 0, 0, 25]],
  ["bajra", "Pearl millet flour (bajra)", "bajra bajri pearl millet", [378, 11, 72.9, 4.2, 8.5, null, 0.7, 5, 195, 8, 3, 114, 1.7, 0, 0, 0, 0, 85]],
  ["tamarind", "Tamarind pulp", "imli chinch tamarind", [239, 2.8, 62.5, 0.6, 5.1, 57.4, 0.3, 28, 628, 74, 2.8, 92, 0.1, 2, 3.5, 0, 0, 14], ["citrus"]],
  ["jaggery", "Jaggery (gur)", "gur gul jaggery", [383, 0.4, 98, 0.1, 0, null, 0, null, null, null, null, null, null, 0, 0, 0, 0, null]],
  ["masoor", "Red lentils (masoor dal, raw)", "masoor dal red lentil", [358, 24, 63, 2.2, 10.8, 1.6, 0.4, 6, 578, 48, 7.4, 59, 3.6, 2, 1.7, 0, 0, 204]],
  ["toor", "Pigeon peas (toor / arhar dal, raw)", "toor tuvar arhar dal pigeon pea", [343, 21.7, 62.8, 1.5, 15, null, 0.3, 17, 1392, 130, 5.2, 183, 2.8, 1, 0, 0, 0, 456]],
  ["moong", "Mung beans / moong dal (raw)", "moong mung green gram dal", [347, 23.9, 62.6, 1.2, 16.3, 6.6, 0.3, 15, 1246, 132, 6.7, 189, 2.7, 6, 4.8, 0, 0, 625]],
  ["chana", "Chickpeas / chana dal (raw)", "chana chole kabuli chickpea garbanzo chana dal", [378, 20.5, 63, 6, 12.2, 10.7, 0.6, 24, 718, 57, 4.3, 79, 2.8, 3, 4, 0, 0, 557]],
  ["rajma", "Kidney beans (rajma, raw)", "rajma kidney beans", [333, 23.6, 60, 0.8, 24.9, 2.2, 0.1, 24, 1406, 143, 8.2, 140, 2.8, 0, 4.5, 0, 0, 394]],
  ["urad", "Black gram (urad dal, raw)", "urad dal black gram", [341, 25.2, 59, 1.6, 18.3, null, 0.1, 38, 983, 138, 7.6, 267, 3.4, 3, 0, 0, 0, 216]],
  ["soya_chunks", "Soya chunks (defatted soy)", "soya chunks nuggets meal maker", [330, 51, 34, 1.2, 17.5, null, 0.1, 20, 2384, 241, 9.2, 290, 2.5, null, 0, 0, 0, null]],
  ["milk_whole", "Milk, whole (full cream)", "milk full cream doodh", [61, 3.2, 4.8, 3.3, 0, 5.1, 1.9, 43, 132, 113, 0, 10, 0.4, 46, 0, null, 0.45, 5]],
  ["milk_toned", "Milk, toned (≈3% fat)", "toned milk", [58, 3.1, 4.7, 3, 0, 4.7, 1.8, 43, 140, 120, 0, 11, 0.4, 30, 0, null, 0.45, 5]],
  ["milk_double_toned", "Milk, double toned (≈1.5% fat)", "double toned skim milk low fat", [46, 3.3, 4.9, 1.5, 0, 5, 0.9, 44, 150, 122, 0, 11, 0.4, 20, 0, null, 0.45, 5]],
  ["curd", "Curd / dahi (whole milk)", "curd dahi yogurt yoghurt raita", [61, 3.5, 4.7, 3.3, 0, 4.7, 2.1, 46, 155, 121, 0.1, 12, 0.6, 27, 0.5, null, 0.37, 7]],
  ["paneer", "Paneer (full fat)", "paneer cottage cheese", [265, 18.3, 1.2, 20.8, 0, 1.2, 13, null, null, null, null, null, null, null, 0, null, null, null]],
  ["ghee", "Ghee", "ghee clarified butter", [876, 0.3, 0, 99.5, 0, 0, 61.9, 2, 5, 4, 0, 0, 0, 840, 0, 1.5, 0, 0]],
  ["butter", "Butter (salted)", "butter makkhan", [717, 0.9, 0.1, 81, 0, 0.1, 51, 643, 24, 24, 0, 2, 0.1, 684, 0, 1.5, 0.17, 3]],
  ["oil_sunflower", "Sunflower / refined oil", "oil refined sunflower vegetable", [884, 0, 0, 100, 0, 0, 10.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ["oil_mustard", "Mustard oil", "mustard oil sarson", [884, 0, 0, 100, 0, 0, 11.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ["oil_groundnut", "Groundnut oil", "groundnut peanut oil", [884, 0, 0, 100, 0, 0, 16.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ["oil_coconut", "Coconut oil", "coconut oil", [862, 0, 0, 100, 0, 0, 82.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ["oil_olive", "Olive oil", "olive oil", [884, 0, 0, 100, 0, 0, 13.8, 2, 1, 1, 0.6, 0, 0, 0, 0, 0, 0, 0]],
  ["egg", "Egg, whole", "egg anda omelette bhurji", [143, 12.6, 0.7, 9.5, 0, 0.4, 3.1, 142, 138, 56, 1.8, 12, 1.3, 160, 0, 2, 0.89, 47]],
  ["chicken_breast", "Chicken breast (raw, skinless)", "chicken breast boneless", [120, 22.5, 0, 2.6, 0, 0, 0.6, 45, 334, 5, 0.4, 28, 0.7, 9, 0, null, 0.2, 4]],
  ["mutton", "Mutton / goat meat (raw)", "mutton goat lamb", [109, 20.6, 0, 2.3, 0, 0, 0.7, 82, 385, 13, 2.8, null, 4, 0, 0, null, 1.13, null]],
  ["salmon", "Salmon (raw)", "salmon fish", [208, 20, 0, 13, 0, 0, 3.1, 59, 363, 9, 0.3, 27, 0.4, 58, 0, 11, 3.2, 26]],
  ["spinach", "Spinach (palak)", "palak spinach saag", [23, 2.9, 3.6, 0.4, 2.2, 0.4, 0.1, 79, 558, 99, 2.7, 79, 0.5, 469, 28, 0, 0, 194]],
  ["onion", "Onion", "onion pyaz kanda", [40, 1.1, 9.3, 0.1, 1.7, 4.2, 0, 4, 146, 23, 0.2, 10, 0.2, 0, 7.4, 0, 0, 19]],
  ["tomato", "Tomato", "tomato tamatar", [18, 0.9, 3.9, 0.2, 1.2, 2.6, 0, 5, 237, 10, 0.3, 11, 0.2, 42, 13.7, 0, 0, 15], ["tomato"]],
  ["potato", "Potato", "potato aloo", [77, 2, 17.5, 0.1, 2.2, 0.8, 0, 6, 425, 12, 0.8, 23, 0.3, 0, 19.7, 0, 0, 15]],
  ["carrot", "Carrot", "carrot gajar", [41, 0.9, 9.6, 0.2, 2.8, 4.7, 0, 69, 320, 33, 0.3, 12, 0.2, 835, 5.9, 0, 0, 19]],
  ["cauliflower", "Cauliflower", "cauliflower gobi", [25, 1.9, 5, 0.3, 2, 1.9, 0.1, 30, 299, 22, 0.4, 15, 0.3, 0, 48.2, 0, 0, 57]],
  ["cabbage", "Cabbage", "cabbage patta gobi", [25, 1.3, 5.8, 0.1, 2.5, 3.2, 0, 18, 170, 40, 0.5, 12, 0.2, 5, 36.6, 0, 0, 43]],
  ["okra", "Okra (bhindi)", "bhindi okra ladyfinger", [33, 1.9, 7.5, 0.2, 3.2, 1.5, 0, 7, 299, 82, 0.6, 57, 0.6, 36, 23, 0, 0, 60]],
  ["peas", "Green peas", "matar peas", [81, 5.4, 14.5, 0.4, 5.7, 5.7, 0.1, 5, 244, 25, 1.5, 33, 1.2, 38, 40, 0, 0, 65]],
  ["capsicum", "Capsicum (green)", "capsicum shimla mirch bell pepper", [20, 0.9, 4.6, 0.2, 1.7, 2.4, 0, 3, 175, 10, 0.3, 10, 0.1, 18, 80.4, 0, 0, 10]],
  ["cucumber", "Cucumber", "cucumber kheera kakdi", [15, 0.7, 3.6, 0.1, 0.5, 1.7, 0, 2, 147, 16, 0.3, 13, 0.2, 5, 2.8, 0, 0, 7]],
  ["brinjal", "Brinjal (eggplant)", "baingan brinjal eggplant", [25, 1, 5.9, 0.2, 3, 3.5, 0, 2, 229, 9, 0.2, 14, 0.2, 1, 2.2, 0, 0, 22]],
  ["lauki", "Bottle gourd (lauki)", "lauki dudhi bottle gourd", [14, 0.6, 3.4, 0, 0.5, null, 0, 2, 150, 26, 0.2, 11, 0.7, 1, 10.1, 0, 0, 6]],
  ["mushroom", "Mushroom (white)", "mushroom", [22, 3.1, 3.3, 0.3, 1, 2, 0, 5, 318, 3, 0.5, 9, 0.5, 0, 2.1, 0.2, 0.04, 17]],
  ["garlic", "Garlic", "garlic lehsun", [149, 6.4, 33, 0.5, 2.1, 1, 0.1, 17, 401, 181, 1.7, 25, 1.2, 0, 31.2, 0, 0, 3]],
  ["ginger", "Ginger", "ginger adrak", [80, 1.8, 17.8, 0.8, 2, 1.7, 0.2, 13, 415, 16, 0.6, 43, 0.3, 0, 5, 0, 0, 11]],
  ["green_chilli", "Green chilli", "green chilli mirchi", [40, 2, 9.5, 0.2, 1.5, 5.1, 0, 7, 340, 18, 1, 25, 0.3, 59, 242, 0, 0, 23], ["spicy"]],
  ["red_chilli_powder", "Red chilli powder", "lal mirch chilli powder", [318, 12, 56.6, 17.3, 27.2, 10.3, 3.3, 30, 2014, 148, 7.8, 152, 2.5, 2081, 76.4, 0, 0, 106], ["spicy"]],
  ["coriander", "Coriander leaves", "dhania coriander cilantro", [23, 2.1, 3.7, 0.5, 2.8, 0.9, 0, 46, 521, 67, 1.8, 26, 0.5, 337, 27, 0, 0, 62]],
  ["lemon_juice", "Lemon juice", "lemon nimbu lime juice", [22, 0.4, 6.9, 0.2, 0.3, 2.5, 0, 1, 103, 6, 0.1, 6, 0, 1, 38.7, 0, 0, 20], ["citrus"]],
  ["banana", "Banana", "banana kela", [89, 1.1, 22.8, 0.3, 2.6, 12.2, 0.1, 1, 358, 5, 0.3, 27, 0.2, 3, 8.7, 0, 0, 20]],
  ["apple", "Apple", "apple seb", [52, 0.3, 13.8, 0.2, 2.4, 10.4, 0, 1, 107, 6, 0.1, 5, 0, 3, 4.6, 0, 0, 3]],
  ["mango", "Mango", "mango aam", [60, 0.8, 15, 0.4, 1.6, 13.7, 0.1, 1, 168, 11, 0.2, 10, 0.1, 54, 36.4, 0, 0, 43]],
  ["orange", "Orange", "orange santra mosambi", [47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, 0, 181, 40, 0.1, 10, 0.1, 11, 53.2, 0, 0, 30], ["citrus"]],
  ["papaya", "Papaya", "papaya papita", [43, 0.5, 10.8, 0.3, 1.7, 7.8, 0.1, 8, 182, 20, 0.3, 21, 0.1, 47, 60.9, 0, 0, 37]],
  ["dates", "Dates", "dates khajur", [277, 1.8, 75, 0.2, 6.7, 66.5, 0, 1, 696, 64, 0.9, 54, 0.4, 7, 0, 0, 0, 15]],
  ["almonds", "Almonds", "almonds badam", [579, 21.2, 21.6, 49.9, 12.5, 4.4, 3.8, 1, 733, 269, 3.7, 270, 3.1, 0, 0, 0, 0, 44]],
  ["peanuts", "Peanuts", "peanuts moongphali groundnuts", [567, 25.8, 16.1, 49.2, 8.5, 4, 6.3, 18, 705, 92, 4.6, 168, 3.3, 0, 0, 0, 0, 240]],
  ["cashews", "Cashews", "cashew kaju", [553, 18.2, 30.2, 43.9, 3.3, 5.9, 7.8, 12, 660, 37, 6.7, 292, 5.8, 0, 0.5, 0, 0, 25]],
  ["walnuts", "Walnuts", "walnut akhrot", [654, 15.2, 13.7, 65.2, 6.7, 2.6, 6.1, 2, 441, 98, 2.9, 158, 3.1, 1, 1.3, 0, 0, 98]],
  ["flax", "Flax seeds", "flax alsi linseed", [534, 18.3, 28.9, 42.2, 27.3, 1.6, 3.7, 30, 813, 255, 5.7, 392, 4.3, 0, 0.6, 0, 0, 87]],
  ["coconut_fresh", "Coconut (fresh)", "coconut nariyal", [354, 3.3, 15.2, 33.5, 9, 6.2, 29.7, 20, 356, 14, 2.4, 32, 1.1, 0, 3.3, 0, 0, 26]],
  ["sugar", "Sugar", "sugar cheeni shakkar", [387, 0, 100, 0, 0, 99.8, 0, 1, 2, 1, 0.1, 0, 0, 0, 0, 0, 0, 0]],
  ["honey", "Honey", "honey shahad", [304, 0.3, 82.4, 0, 0.2, 82.1, 0, 4, 52, 6, 0.4, 2, 0.2, 0, 0.5, 0, 0, 2]],
  ["salt", "Salt", "salt namak", [0, 0, 0, 0, 0, 0, 0, 38758, 8, 24, 0.3, 1, 0.1, 0, 0, 0, 0, 0]],
  ["dark_chocolate", "Dark chocolate (70–85%)", "dark chocolate", [598, 7.8, 45.9, 42.6, 10.9, 24, 24.5, 20, 715, 73, 11.9, 228, 3.3, 2, 0, 0, 0.28, 0], ["chocolate", "caffeine"]],
];

const KEYS = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sat_fat_g", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "zinc_mg", "vit_a_mcg", "vit_c_mg", "vit_d_mcg", "b12_mcg", "folate_mcg"] as const;

export type Staple = { key: string; name: string; aliases: string; per100: Nutrients; irritants: Irritant[] };

export const STAPLES: Staple[] = ROWS.map(([key, name, aliases, values, irritants]) => ({
  key,
  name,
  aliases,
  irritants: irritants ?? [],
  per100: Object.fromEntries(KEYS.map((k, i) => [k, values[i]]).filter(([, v]) => v !== null)) as Nutrients,
}));

export const STAPLE_BY_KEY = Object.fromEntries(STAPLES.map((s) => [s.key, s])) as Record<string, Staple>;

/** Simple ranked search over staple names and aliases. */
export function searchStaples(query: string, limit = 8): Staple[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/\s+/);
  return STAPLES.map((s) => {
    const hay = `${s.name} ${s.aliases}`.toLowerCase();
    const score = words.reduce((a, w) => a + (hay.includes(w) ? (hay.startsWith(w) || hay.includes(` ${w}`) ? 2 : 1) : 0), 0);
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

/** Household measures used to turn "1 katori" etc. into grams (passed to AI as guidance). */
export const MEASURE_HINTS = `Household measures (grams, approximate):
- 1 roti/phulka = 30 g whole wheat flour (dry) (+ 3 g ghee if ghee is applied); 1 paratha = 50 g atta + 7 g ghee/oil
- 1 katori/bowl cooked dal, sabzi or curd ≈ 150 g; dry dal per katori of cooked dal ≈ 35 g
- 1 cup cooked rice ≈ 160 g (≈ 55 g raw rice); 1 cup = 240 ml; 1 glass = 250 ml
- 1 tbsp oil ≈ 13.5 g; 1 tbsp ghee ≈ 13 g; 1 tsp oil/ghee ≈ 4.5 g; 1 tsp sugar ≈ 4 g; 1 tsp salt ≈ 6 g; 1 tbsp flour ≈ 8 g
- 1 egg ≈ 50 g (edible); 1 medium onion ≈ 110 g; 1 medium tomato ≈ 120 g; 1 medium potato ≈ 150 g; 1 banana ≈ 118 g; 1 apple ≈ 180 g
- 1 slice bread ≈ 25–30 g; 1 idli ≈ 40 g; 1 dosa ≈ 80–100 g`;
