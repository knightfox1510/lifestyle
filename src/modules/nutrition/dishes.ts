import { forGrams, sum, type Nutrients } from "./nutrients";
import { STAPLE_BY_KEY } from "./staples";
import type { Irritant } from "./irritants";

/**
 * Built-in Indian dishes as standard home recipes: ingredient grams per
 * serving (raw/dry weights, cooking oil included). Nutrition is calculated
 * from the staples table, the same way as your own recipes. Home versions
 * vary, so copy a dish to "My recipes" to match how you cook it.
 */
export type Dish = {
  key: string;
  name: string;
  aliases: string;
  region: "South" | "Maharashtrian" | "North" | "Gujarati & snacks" | "Rice & breads" | "Drinks" | "Sweets";
  serving: string;
  servingG: number;
  ingredients: [stapleKey: string, grams: number][];
  irritants?: Irritant[];
};

export const DISHES: Dish[] = [
  // South
  { key: "plain_dosa", name: "Plain dosa", aliases: "dosa dosai sada dosa", region: "South", serving: "1 dosa", servingG: 90, ingredients: [["rice_white", 40], ["urad", 12], ["oil_sunflower", 5]] },
  { key: "masala_dosa", name: "Masala dosa", aliases: "masala dosai", region: "South", serving: "1 dosa with potato masala", servingG: 220, ingredients: [["rice_white", 40], ["urad", 12], ["oil_sunflower", 9], ["potato", 100], ["onion", 25]] },
  { key: "idli", name: "Idli", aliases: "idly iddli", region: "South", serving: "2 idlis", servingG: 80, ingredients: [["rice_white", 28], ["urad", 9]] },
  { key: "sambar", name: "Sambar", aliases: "sambhar saaru", region: "South", serving: "1 katori (150 g)", servingG: 150, ingredients: [["toor", 20], ["tomato", 25], ["onion", 20], ["lauki", 30], ["tamarind", 3], ["oil_sunflower", 4]], irritants: ["tomato"] },
  { key: "rasam", name: "Rasam", aliases: "saar chaaru", region: "South", serving: "1 katori (150 ml)", servingG: 150, ingredients: [["toor", 8], ["tomato", 40], ["tamarind", 5], ["oil_sunflower", 3]], irritants: ["tomato", "spicy"] },
  { key: "coconut_chutney", name: "Coconut chutney", aliases: "nariyal chutney thengai", region: "South", serving: "2 tbsp (40 g)", servingG: 40, ingredients: [["coconut_fresh", 20], ["chana", 5], ["oil_sunflower", 2]] },
  { key: "upma", name: "Upma", aliases: "uppittu rava upma", region: "South", serving: "1 plate (180 g)", servingG: 180, ingredients: [["rava", 45], ["oil_sunflower", 7], ["onion", 20], ["peas", 10]] },
  { key: "uttapam", name: "Uttapam", aliases: "uthappam onion uttapam", region: "South", serving: "1 uttapam", servingG: 160, ingredients: [["rice_white", 45], ["urad", 14], ["onion", 25], ["tomato", 20], ["oil_sunflower", 7]], irritants: ["tomato"] },
  { key: "medu_vada", name: "Medu vada", aliases: "vada wada uddina vada", region: "South", serving: "2 vadas", servingG: 90, ingredients: [["urad", 40], ["oil_sunflower", 12], ["onion", 10]] },
  { key: "curd_rice", name: "Curd rice", aliases: "dahi chawal thayir sadam", region: "South", serving: "1 bowl (220 g)", servingG: 220, ingredients: [["rice_white", 45], ["curd", 100], ["oil_sunflower", 3]] },
  // Maharashtrian
  { key: "matki_usal", name: "Matki chi bhaji / usal", aliases: "matki usal matki chi bhaji moth bean curry math", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["matki", 40], ["onion", 25], ["tomato", 20], ["coconut_fresh", 5], ["oil_sunflower", 6]], irritants: ["spicy", "tomato"] },
  { key: "misal", name: "Misal (without pav)", aliases: "misal kat usal", region: "Maharashtrian", serving: "1 bowl with farsan", servingG: 250, ingredients: [["matki", 40], ["onion", 30], ["tomato", 20], ["besan", 15], ["oil_sunflower", 20]], irritants: ["spicy", "tomato"] },
  { key: "misal_pav", name: "Misal pav", aliases: "misal pav", region: "Maharashtrian", serving: "1 bowl + 2 pav", servingG: 330, ingredients: [["matki", 40], ["onion", 30], ["tomato", 20], ["besan", 15], ["oil_sunflower", 20], ["maida", 60], ["sugar", 3]], irritants: ["spicy", "tomato"] },
  { key: "kanda_poha", name: "Kanda poha", aliases: "pohe poha batata poha", region: "Maharashtrian", serving: "1 plate (160 g)", servingG: 160, ingredients: [["poha", 50], ["onion", 30], ["potato", 20], ["peanuts", 10], ["oil_sunflower", 7]] },
  { key: "sabudana_khichdi", name: "Sabudana khichdi", aliases: "sabudana khichadi sago khichdi upvas", region: "Maharashtrian", serving: "1 plate (200 g)", servingG: 200, ingredients: [["sabudana", 70], ["peanuts", 25], ["potato", 40], ["ghee", 8]] },
  { key: "pithla", name: "Pithla", aliases: "pitla besan curry", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["besan", 30], ["onion", 20], ["oil_sunflower", 6]], irritants: ["spicy"] },
  { key: "zunka", name: "Zunka", aliases: "jhunka dry besan", region: "Maharashtrian", serving: "1 katori (100 g)", servingG: 100, ingredients: [["besan", 35], ["onion", 40], ["oil_sunflower", 8]], irritants: ["spicy"] },
  { key: "varan", name: "Varan (plain dal)", aliases: "varan bhaat toor dal plain dal", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["toor", 30], ["ghee", 2]] },
  { key: "jowar_bhakri", name: "Jowar bhakri", aliases: "jwarichi bhakri jowar roti", region: "Maharashtrian", serving: "1 bhakri", servingG: 70, ingredients: [["jowar", 50]] },
  { key: "bajra_bhakri", name: "Bajra bhakri", aliases: "bajrichi bhakri bajra roti", region: "Maharashtrian", serving: "1 bhakri", servingG: 70, ingredients: [["bajra", 50]] },
  { key: "thalipeeth", name: "Thalipeeth", aliases: "thalipith bhajani", region: "Maharashtrian", serving: "1 thalipeeth", servingG: 100, ingredients: [["besan", 15], ["jowar", 15], ["rice_white", 10], ["bajra", 10], ["onion", 20], ["oil_sunflower", 6]] },
  { key: "vada_pav", name: "Vada pav", aliases: "wada pav batata vada", region: "Maharashtrian", serving: "1 vada pav", servingG: 160, ingredients: [["potato", 90], ["besan", 20], ["oil_sunflower", 15], ["maida", 35], ["sugar", 2]], irritants: ["spicy"] },
  { key: "pav_bhaji", name: "Pav bhaji", aliases: "pav bhaji", region: "Maharashtrian", serving: "1 plate (bhaji + 2 pav)", servingG: 350, ingredients: [["potato", 80], ["peas", 20], ["capsicum", 20], ["tomato", 50], ["onion", 30], ["butter", 15], ["maida", 70], ["sugar", 3]], irritants: ["spicy", "tomato"] },
  { key: "sheera", name: "Sheera (rava halwa)", aliases: "shira sooji halwa kesari", region: "Sweets", serving: "1 katori (120 g)", servingG: 120, ingredients: [["rava", 35], ["ghee", 12], ["sugar", 25], ["milk_whole", 50]] },
  // North
  { key: "dal_tadka", name: "Dal tadka", aliases: "dal fry yellow dal tadka", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["toor", 20], ["masoor", 10], ["ghee", 5], ["onion", 15], ["tomato", 20]], irritants: ["tomato"] },
  { key: "dal_makhani", name: "Dal makhani", aliases: "maa ki dal kaali dal", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["urad", 25], ["rajma", 8], ["butter", 10], ["ghee", 5], ["milk_whole", 15], ["tomato", 30]], irritants: ["tomato"] },
  { key: "rajma", name: "Rajma (curry)", aliases: "rajma masala kidney bean curry", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["rajma", 35], ["onion", 30], ["tomato", 40], ["oil_sunflower", 7]], irritants: ["tomato", "spicy"] },
  { key: "chole", name: "Chole", aliases: "chana masala chhole", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["chana", 40], ["onion", 30], ["tomato", 40], ["oil_sunflower", 8]], irritants: ["tomato", "spicy"] },
  { key: "aloo_gobi", name: "Aloo gobi", aliases: "aloo gobhi batata flower", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["potato", 70], ["cauliflower", 80], ["onion", 15], ["tomato", 15], ["oil_sunflower", 8]] },
  { key: "bhindi_masala", name: "Bhindi sabzi", aliases: "bhindi masala bhendi okra fry", region: "North", serving: "1 katori (120 g)", servingG: 120, ingredients: [["okra", 120], ["onion", 30], ["tomato", 15], ["oil_sunflower", 10]] },
  { key: "palak_paneer", name: "Palak paneer", aliases: "saag paneer", region: "North", serving: "1 katori (180 g)", servingG: 180, ingredients: [["spinach", 120], ["paneer", 60], ["onion", 20], ["tomato", 15], ["oil_sunflower", 6], ["butter", 5]] },
  { key: "paneer_bhurji", name: "Paneer bhurji", aliases: "paneer bhurji scrambled paneer", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["paneer", 80], ["onion", 30], ["tomato", 30], ["capsicum", 15], ["oil_sunflower", 7]], irritants: ["tomato"] },
  { key: "kadhi", name: "Kadhi (without pakora)", aliases: "kadhi kadi gujarati kadhi", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["curd", 100], ["besan", 12], ["oil_sunflower", 5]] },
  { key: "khichdi", name: "Moong dal khichdi", aliases: "khichdi khichadi", region: "Rice & breads", serving: "1 bowl (220 g)", servingG: 220, ingredients: [["rice_white", 30], ["moong", 20], ["ghee", 5]] },
  { key: "mixed_veg", name: "Mixed veg sabzi", aliases: "mix veg sabji bhaji", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["cauliflower", 40], ["carrot", 30], ["peas", 20], ["potato", 40], ["oil_sunflower", 8]] },
  { key: "lauki_sabzi", name: "Lauki sabzi", aliases: "dudhi bhaji ghiya sabzi bottle gourd", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["lauki", 150], ["tomato", 15], ["oil_sunflower", 5]] },
  { key: "chicken_curry", name: "Chicken curry", aliases: "chicken masala murgh", region: "North", serving: "1 katori (200 g)", servingG: 200, ingredients: [["chicken_breast", 120], ["onion", 40], ["tomato", 40], ["curd", 20], ["oil_sunflower", 12]], irritants: ["spicy", "tomato"] },
  { key: "egg_curry", name: "Egg curry", aliases: "anda curry egg masala", region: "North", serving: "2 eggs with gravy", servingG: 220, ingredients: [["egg", 100], ["onion", 30], ["tomato", 40], ["oil_sunflower", 10]], irritants: ["spicy", "tomato"] },
  // Rice & breads
  { key: "phulka", name: "Roti / phulka (no ghee)", aliases: "roti chapati phulka poli", region: "Rice & breads", serving: "1 roti", servingG: 40, ingredients: [["atta", 30]] },
  { key: "roti_ghee", name: "Roti with ghee", aliases: "tup poli ghee roti chapati with ghee", region: "Rice & breads", serving: "1 roti", servingG: 43, ingredients: [["atta", 30], ["ghee", 3]] },
  { key: "plain_paratha", name: "Plain paratha", aliases: "paratha parotha", region: "Rice & breads", serving: "1 paratha", servingG: 70, ingredients: [["atta", 50], ["ghee", 7]] },
  { key: "aloo_paratha", name: "Aloo paratha", aliases: "aloo parotha potato paratha", region: "Rice & breads", serving: "1 paratha", servingG: 150, ingredients: [["atta", 60], ["potato", 70], ["ghee", 10]] },
  { key: "steamed_rice", name: "Steamed rice", aliases: "bhaat chawal plain rice", region: "Rice & breads", serving: "1 cup cooked (160 g)", servingG: 160, ingredients: [["rice_white", 55]] },
  { key: "jeera_rice", name: "Jeera rice", aliases: "jeera rice cumin rice", region: "Rice & breads", serving: "1 cup (170 g)", servingG: 170, ingredients: [["rice_white", 55], ["ghee", 5]] },
  { key: "veg_pulao", name: "Veg pulao", aliases: "pulav pulao", region: "Rice & breads", serving: "1 cup (200 g)", servingG: 200, ingredients: [["rice_white", 55], ["peas", 15], ["carrot", 15], ["oil_sunflower", 6]] },
  // Gujarati & snacks
  { key: "dhokla", name: "Dhokla", aliases: "khaman dhokla", region: "Gujarati & snacks", serving: "2 pieces (80 g)", servingG: 80, ingredients: [["besan", 30], ["oil_sunflower", 4], ["sugar", 3]] },
  { key: "thepla", name: "Methi thepla", aliases: "thepla", region: "Gujarati & snacks", serving: "1 thepla", servingG: 50, ingredients: [["atta", 30], ["besan", 5], ["curd", 5], ["oil_sunflower", 5]] },
  { key: "samosa", name: "Samosa", aliases: "samosa", region: "Gujarati & snacks", serving: "1 samosa", servingG: 100, ingredients: [["maida", 30], ["potato", 50], ["peas", 10], ["oil_sunflower", 15]], irritants: ["spicy"] },
  { key: "onion_pakora", name: "Onion pakora / bhajji", aliases: "kanda bhaji pakoda bhajiya", region: "Gujarati & snacks", serving: "5 pieces", servingG: 90, ingredients: [["besan", 30], ["onion", 40], ["oil_sunflower", 15]] },
  // Drinks
  { key: "masala_chai", name: "Chai (with milk & sugar)", aliases: "chai tea masala chai cutting", region: "Drinks", serving: "1 cup (150 ml)", servingG: 150, ingredients: [["milk_whole", 75], ["sugar", 8]], irritants: ["caffeine"] },
  { key: "filter_coffee", name: "Filter coffee", aliases: "kaapi coffee", region: "Drinks", serving: "1 cup (150 ml)", servingG: 150, ingredients: [["milk_whole", 100], ["sugar", 8]], irritants: ["caffeine"] },
  { key: "chaas", name: "Chaas (buttermilk)", aliases: "taak majjige buttermilk mattha", region: "Drinks", serving: "1 glass (250 ml)", servingG: 250, ingredients: [["curd", 80], ["salt", 1]] },
  { key: "sweet_lassi", name: "Sweet lassi", aliases: "lassi", region: "Drinks", serving: "1 glass (250 ml)", servingG: 250, ingredients: [["curd", 200], ["sugar", 20]] },
  // Sweets
  { key: "kheer", name: "Kheer", aliases: "payasam rice pudding", region: "Sweets", serving: "1 katori (150 g)", servingG: 150, ingredients: [["milk_whole", 150], ["rice_white", 15], ["sugar", 15]] },
  { key: "besan_ladoo", name: "Besan ladoo", aliases: "besan laddu", region: "Sweets", serving: "1 ladoo (40 g)", servingG: 40, ingredients: [["besan", 18], ["ghee", 10], ["sugar", 12]] },
];

export const DISH_BY_KEY = Object.fromEntries(DISHES.map((d) => [d.key, d])) as Record<string, Dish>;

/** Nutrition for one serving of a dish (calculated from the staples). */
export function dishNutrition(d: Dish): Nutrients {
  return sum(d.ingredients.map(([key, g]) => forGrams(STAPLE_BY_KEY[key].per100, g)));
}

export function dishPer100(d: Dish): Nutrients {
  const n = dishNutrition(d);
  return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, Math.round(((v as number) * 100) / d.servingG * 10) / 10])) as Nutrients;
}

export function searchDishes(query: string, limit = 6): Dish[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/\s+/).filter((w) => w.length > 1 && !["chi", "ki", "ka", "the", "with"].includes(w));
  if (!words.length) return [];
  return DISHES.map((d) => {
    const hay = `${d.name} ${d.aliases}`.toLowerCase();
    const score = words.reduce((a, w) => a + (hay.includes(w) ? (hay.startsWith(w) || hay.includes(` ${w}`) ? 2 : 1) : 0), 0);
    return { d, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d);
}
