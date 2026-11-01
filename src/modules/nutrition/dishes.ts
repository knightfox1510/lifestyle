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
  region: "Maharashtrian" | "Konkan & Malvani" | "Fasting (upvas)" | "South" | "North" | "Gujarati & snacks" | "Street food" | "East" | "Rice & breads" | "Eggs, salads & sides" | "Drinks" | "Sweets";
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
  { key: "misal_pav", name: "Misal pav", aliases: "misal pav", region: "Maharashtrian", serving: "1 bowl + 2 pav", servingG: 330, ingredients: [["matki", 40], ["onion", 30], ["tomato", 20], ["besan", 15], ["oil_sunflower", 20], ["bread_white", 80]], irritants: ["spicy", "tomato"] },
  { key: "kanda_poha", name: "Kanda poha", aliases: "pohe poha batata poha", region: "Maharashtrian", serving: "1 plate (160 g)", servingG: 160, ingredients: [["poha", 50], ["onion", 30], ["potato", 20], ["peanuts", 10], ["oil_sunflower", 7]] },
  { key: "sabudana_khichdi", name: "Sabudana khichdi", aliases: "sabudana khichadi sago khichdi upvas", region: "Maharashtrian", serving: "1 plate (200 g)", servingG: 200, ingredients: [["sabudana", 70], ["peanuts", 25], ["potato", 40], ["ghee", 8]] },
  { key: "pithla", name: "Pithla", aliases: "pitla besan curry", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["besan", 30], ["onion", 20], ["oil_sunflower", 6]], irritants: ["spicy"] },
  { key: "zunka", name: "Zunka", aliases: "jhunka dry besan", region: "Maharashtrian", serving: "1 katori (100 g)", servingG: 100, ingredients: [["besan", 35], ["onion", 40], ["oil_sunflower", 8]], irritants: ["spicy"] },
  { key: "varan", name: "Varan (plain dal)", aliases: "varan bhaat toor dal plain dal", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["toor", 30], ["ghee", 2]] },
  { key: "jowar_bhakri", name: "Jowar bhakri", aliases: "jwarichi bhakri jowar roti", region: "Maharashtrian", serving: "1 bhakri", servingG: 70, ingredients: [["jowar", 50]] },
  { key: "bajra_bhakri", name: "Bajra bhakri", aliases: "bajrichi bhakri bajra roti", region: "Maharashtrian", serving: "1 bhakri", servingG: 70, ingredients: [["bajra", 50]] },
  { key: "thalipeeth", name: "Thalipeeth", aliases: "thalipith bhajani", region: "Maharashtrian", serving: "1 thalipeeth", servingG: 100, ingredients: [["besan", 15], ["jowar", 15], ["rice_white", 10], ["bajra", 10], ["onion", 20], ["oil_sunflower", 6]] },
  { key: "vada_pav", name: "Vada pav", aliases: "wada pav batata vada", region: "Maharashtrian", serving: "1 vada pav", servingG: 160, ingredients: [["potato", 90], ["besan", 20], ["oil_sunflower", 15], ["bread_white", 40]], irritants: ["spicy"] },
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
  // ---- More Maharashtrian
  { key: "batata_vada", name: "Batata vada (without pav)", aliases: "batata wada aloo vada", region: "Maharashtrian", serving: "1 vada", servingG: 70, ingredients: [["potato", 60], ["besan", 15], ["oil_sunflower", 10]], irritants: ["spicy"] },
  { key: "kothimbir_vadi", name: "Kothimbir vadi", aliases: "kothimbir wadi coriander vadi", region: "Maharashtrian", serving: "3 pieces (90 g)", servingG: 90, ingredients: [["besan", 35], ["coriander", 20], ["oil_sunflower", 10], ["sesame", 2]], irritants: ["spicy"] },
  { key: "dadpe_pohe", name: "Dadpe pohe", aliases: "dadpe pohe dadape poha", region: "Maharashtrian", serving: "1 plate (130 g)", servingG: 130, ingredients: [["poha", 45], ["coconut_fresh", 12], ["onion", 20], ["oil_sunflower", 4], ["lemon_juice", 3]] },
  { key: "ghavan", name: "Ghavan (rice flour crepe)", aliases: "ghavan ghavne", region: "Maharashtrian", serving: "2 ghavan", servingG: 120, ingredients: [["rice_flour", 50], ["oil_sunflower", 5]] },
  { key: "ukad", name: "Ukad (spiced rice flour)", aliases: "ukad ukkad pej", region: "Maharashtrian", serving: "1 bowl (150 g)", servingG: 150, ingredients: [["rice_flour", 35], ["curd", 30], ["oil_sunflower", 5]] },
  { key: "besan_chilla", name: "Besan chilla / dhirde", aliases: "besan cheela dhirde dhirdi pudla", region: "Maharashtrian", serving: "1 chilla (100 g)", servingG: 100, ingredients: [["besan", 40], ["onion", 15], ["tomato", 10], ["oil_sunflower", 5]], irritants: ["tomato"] },
  { key: "bhadang", name: "Bhadang / kurmura chivda", aliases: "bhadang murmura chivda kurmura chivda", region: "Maharashtrian", serving: "1 bowl (40 g)", servingG: 40, ingredients: [["puffed_rice", 30], ["peanuts", 6], ["oil_sunflower", 5]], irritants: ["spicy"] },
  { key: "poha_chivda", name: "Poha chivda", aliases: "chivda chiwda patal pohe chivda", region: "Maharashtrian", serving: "1 bowl (40 g)", servingG: 40, ingredients: [["poha", 25], ["peanuts", 6], ["oil_sunflower", 8], ["sugar", 1]] },
  { key: "bharli_vangi", name: "Bharli vangi (stuffed brinjal)", aliases: "bharli vangi bharwa baingan stuffed brinjal", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["brinjal", 120], ["peanuts", 10], ["dry_coconut", 8], ["sesame", 3], ["onion", 15], ["oil_sunflower", 8], ["jaggery", 3], ["tamarind", 2]], irritants: ["spicy"] },
  { key: "vangyache_bharit", name: "Vangyache bharit (baingan bharta)", aliases: "bharit baingan bharta vangi bharta", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["brinjal", 150], ["onion", 20], ["oil_sunflower", 6], ["peanuts", 5]] },
  { key: "batata_bhaji", name: "Batata bhaji (dry potato)", aliases: "batata bhaji aloo sabzi bhaji potato", region: "Maharashtrian", serving: "1 katori (130 g)", servingG: 130, ingredients: [["potato", 120], ["oil_sunflower", 6]] },
  { key: "flower_bhaji", name: "Flower bhaji (cauliflower)", aliases: "phool kobi flower bhaji gobi sabzi", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["cauliflower", 140], ["peas", 10], ["oil_sunflower", 6]] },
  { key: "kobi_bhaji", name: "Kobi bhaji (cabbage)", aliases: "kobi bhaji patta gobi cabbage sabzi", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["cabbage", 150], ["chana", 5], ["oil_sunflower", 5], ["coconut_fresh", 5]] },
  { key: "methi_bhaji", name: "Methi bhaji", aliases: "methichi bhaji methi sabzi", region: "Maharashtrian", serving: "1 katori (110 g)", servingG: 110, ingredients: [["methi", 120], ["besan", 10], ["onion", 15], ["oil_sunflower", 6]] },
  { key: "chawli_leaves_bhaji", name: "Lal math / chawli bhaji (leafy)", aliases: "lal math bhaji chawli bhaji amaranth leaves", region: "Maharashtrian", serving: "1 katori (110 g)", servingG: 110, ingredients: [["amaranth_leaves", 130], ["onion", 15], ["oil_sunflower", 5]] },
  { key: "karela_bhaji", name: "Karela bhaji", aliases: "karlyachi bhaji karela sabzi bitter gourd", region: "Maharashtrian", serving: "1 katori (100 g)", servingG: 100, ingredients: [["karela", 100], ["onion", 25], ["jaggery", 3], ["oil_sunflower", 8], ["peanuts", 5]] },
  { key: "dodka_bhaji", name: "Dodka bhaji", aliases: "dodkyachi bhaji turai sabzi ridge gourd", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["dodka", 150], ["chana", 5], ["oil_sunflower", 5], ["peanuts", 5]] },
  { key: "tondli_bhaji", name: "Tondli bhaji", aliases: "tondlyachi bhaji tindora sabzi", region: "Maharashtrian", serving: "1 katori (130 g)", servingG: 130, ingredients: [["tondli", 130], ["oil_sunflower", 6], ["peanuts", 5], ["dry_coconut", 5]] },
  { key: "bhopla_bhaji", name: "Lal bhopla bhaji (pumpkin)", aliases: "bhoplyachi bhaji kaddu sabzi pumpkin", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["pumpkin", 150], ["jaggery", 5], ["peanuts", 5], ["oil_sunflower", 5]] },
  { key: "shevga_amti", name: "Shevgyachi amti (drumstick dal)", aliases: "shevga amti drumstick sambar shevgyachya shengachi amti", region: "Maharashtrian", serving: "1 katori (180 g)", servingG: 180, ingredients: [["drumstick", 60], ["toor", 20], ["tamarind", 2], ["jaggery", 4], ["dry_coconut", 5], ["oil_sunflower", 4]], irritants: ["spicy"] },
  { key: "amti", name: "Amti (Maharashtrian toor dal)", aliases: "amti goda masala dal aamti", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["toor", 25], ["tamarind", 3], ["jaggery", 5], ["coconut_fresh", 5], ["oil_sunflower", 4]], irritants: ["spicy"] },
  { key: "katachi_amti", name: "Katachi amti", aliases: "katachi amti kat amti", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["chana", 8], ["tamarind", 3], ["jaggery", 5], ["dry_coconut", 4], ["oil_sunflower", 4]], irritants: ["spicy"] },
  { key: "dalimbi_usal", name: "Dalimbi usal (val)", aliases: "dalimbi usal val usal vaal", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["val", 40], ["onion", 20], ["coconut_fresh", 8], ["jaggery", 3], ["oil_sunflower", 6]], irritants: ["spicy"] },
  { key: "kala_vatana_usal", name: "Kala vatana usal", aliases: "kala vatana usal kala vatana sambar", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["peas_dried", 40], ["onion", 25], ["dry_coconut", 10], ["oil_sunflower", 7]], irritants: ["spicy"] },
  { key: "chawli_usal", name: "Chawli usal", aliases: "chawli usal lobia curry chawli amti", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["chawli", 40], ["onion", 20], ["tomato", 20], ["oil_sunflower", 6]], irritants: ["tomato"] },
  { key: "moong_usal", name: "Moong usal (sprouted)", aliases: "moong usal modachi usal sprouts usal", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["moong_sprouts", 120], ["onion", 20], ["coconut_fresh", 5], ["oil_sunflower", 6]] },
  { key: "masale_bhaat", name: "Masale bhaat / vangi bhaat", aliases: "masale bhat masala bhat vangi bhat", region: "Maharashtrian", serving: "1 plate (220 g)", servingG: 220, ingredients: [["rice_white", 55], ["brinjal", 40], ["peas", 10], ["dry_coconut", 5], ["oil_sunflower", 8]], irritants: ["spicy"] },
  { key: "varan_bhaat", name: "Varan bhaat with ghee", aliases: "varan bhat toop", region: "Maharashtrian", serving: "1 plate (310 g)", servingG: 310, ingredients: [["toor", 30], ["rice_white", 55], ["ghee", 5]] },
  { key: "fodnicha_bhaat", name: "Fodnicha bhaat", aliases: "fodnicha bhat phodnicha bhaat tadka rice", region: "Maharashtrian", serving: "1 plate (180 g)", servingG: 180, ingredients: [["rice_white", 55], ["onion", 15], ["oil_sunflower", 6], ["peanuts", 5]] },
  { key: "tomato_saar", name: "Tomato saar", aliases: "tomato saar tomatoche saar", region: "Maharashtrian", serving: "1 katori (200 g)", servingG: 200, ingredients: [["tomato", 100], ["coconut_fresh", 10], ["jaggery", 4], ["ghee", 3]], irritants: ["tomato"] },
  { key: "tambda_rassa", name: "Tambda rassa (Kolhapuri mutton)", aliases: "tambda rassa kolhapuri mutton mutton rassa", region: "Maharashtrian", serving: "1 katori (220 g)", servingG: 220, ingredients: [["mutton", 100], ["onion", 30], ["dry_coconut", 10], ["oil_sunflower", 12], ["sesame", 2]], irritants: ["spicy"] },
  { key: "pandhra_rassa", name: "Pandhra rassa", aliases: "pandhra rassa white mutton curry", region: "Maharashtrian", serving: "1 katori (200 g)", servingG: 200, ingredients: [["mutton", 60], ["coconut_milk", 60], ["cashews", 5], ["oil_sunflower", 5]] },
  { key: "chicken_kolhapuri", name: "Chicken Kolhapuri", aliases: "kolhapuri chicken kombdi rassa", region: "Maharashtrian", serving: "1 katori (220 g)", servingG: 220, ingredients: [["chicken_curry_cut", 130], ["onion", 40], ["dry_coconut", 12], ["oil_sunflower", 12], ["tomato", 20]], irritants: ["spicy", "tomato"] },
  { key: "shev_bhaji", name: "Shev bhaji (Khandeshi)", aliases: "shev bhaji sev bhaji sev tamatar", region: "Maharashtrian", serving: "1 katori (200 g)", servingG: 200, ingredients: [["besan", 30], ["oil_sunflower", 18], ["onion", 30], ["tomato", 30], ["dry_coconut", 5]], irritants: ["spicy", "tomato"] },
  { key: "kakdi_koshimbir", name: "Kakdi koshimbir", aliases: "koshimbir kakdi cucumber salad", region: "Maharashtrian", serving: "1 katori (120 g)", servingG: 120, ingredients: [["cucumber", 80], ["curd", 30], ["peanuts", 8]] },
  { key: "tandlachi_bhakri", name: "Rice bhakri", aliases: "tandlachi bhakri rice roti tandalachi bhakri", region: "Maharashtrian", serving: "1 bhakri", servingG: 60, ingredients: [["rice_flour", 45]] },
  { key: "nachni_bhakri", name: "Nachni bhakri", aliases: "nachni bhakri ragi roti nachni", region: "Maharashtrian", serving: "1 bhakri", servingG: 65, ingredients: [["ragi", 45]] },
  { key: "puran_poli", name: "Puran poli", aliases: "puranpoli holige obbattu", region: "Maharashtrian", serving: "1 poli (100 g)", servingG: 100, ingredients: [["chana", 30], ["jaggery", 30], ["maida", 15], ["atta", 10], ["ghee", 8]] },
  { key: "ukadiche_modak", name: "Ukadiche modak", aliases: "modak ukadiche modak steamed modak", region: "Maharashtrian", serving: "1 modak", servingG: 45, ingredients: [["rice_flour", 15], ["coconut_fresh", 12], ["jaggery", 10], ["ghee", 2]] },
  { key: "shrikhand", name: "Shrikhand", aliases: "shrikhand amrakhand chakka", region: "Maharashtrian", serving: "1 katori (100 g)", servingG: 100, ingredients: [["curd", 140], ["sugar", 25]] },
  { key: "basundi", name: "Basundi", aliases: "basundi rabdi", region: "Maharashtrian", serving: "1 katori (120 g)", servingG: 120, ingredients: [["milk_whole", 300], ["sugar", 15]] },
  { key: "karanji", name: "Karanji", aliases: "karanji gujiya", region: "Maharashtrian", serving: "1 karanji", servingG: 40, ingredients: [["maida", 15], ["dry_coconut", 8], ["sugar", 7], ["oil_sunflower", 7], ["sesame", 1]] },
  { key: "chakli", name: "Chakli", aliases: "chakli murukku", region: "Maharashtrian", serving: "3 chaklis (45 g)", servingG: 45, ingredients: [["rice_flour", 20], ["urad", 5], ["chana", 5], ["oil_sunflower", 12], ["sesame", 1]] },
  { key: "shankarpali", name: "Shankarpali", aliases: "shankarpali shakarpara", region: "Maharashtrian", serving: "1 handful (40 g)", servingG: 40, ingredients: [["maida", 20], ["sugar", 8], ["ghee", 4], ["oil_sunflower", 7]] },
  { key: "tilgul_ladoo", name: "Tilgul ladoo", aliases: "tilgul til ladoo til gul", region: "Maharashtrian", serving: "1 ladoo", servingG: 20, ingredients: [["sesame", 9], ["jaggery", 9], ["peanuts", 2]] },
  { key: "chikki", name: "Shengdana chikki", aliases: "chikki peanut chikki shengdana", region: "Maharashtrian", serving: "1 piece (25 g)", servingG: 25, ingredients: [["peanuts", 13], ["jaggery", 12]] },
  { key: "aamras", name: "Aamras", aliases: "aamras amras mango pulp", region: "Maharashtrian", serving: "1 katori (150 g)", servingG: 150, ingredients: [["mango", 140], ["sugar", 8]] },
  { key: "ambil", name: "Ambil (nachni with buttermilk)", aliases: "ambil nachni ambil ragi java", region: "Drinks", serving: "1 glass (250 ml)", servingG: 250, ingredients: [["ragi", 15], ["curd", 60]] },
  // ---- Konkan & Malvani
  { key: "sol_kadhi", name: "Sol kadhi", aliases: "solkadhi sol kadi kokum kadhi", region: "Konkan & Malvani", serving: "1 glass (150 ml)", servingG: 150, ingredients: [["coconut_milk", 80], ["salt", 0.5]] },
  { key: "malvani_chicken", name: "Malvani chicken", aliases: "malvani chicken kombdi malvani chicken curry", region: "Konkan & Malvani", serving: "1 katori (220 g)", servingG: 220, ingredients: [["chicken_curry_cut", 130], ["onion", 30], ["coconut_fresh", 20], ["oil_sunflower", 10]], irritants: ["spicy"] },
  { key: "kombdi_vade", name: "Kombdi vade", aliases: "kombdi vade chicken vade malvani vade", region: "Konkan & Malvani", serving: "1 plate (curry + 2 vade)", servingG: 300, ingredients: [["chicken_curry_cut", 130], ["onion", 30], ["coconut_fresh", 20], ["oil_sunflower", 22], ["rice_flour", 40], ["urad", 8]], irritants: ["spicy"] },
  { key: "kolambi_masala", name: "Kolambi masala", aliases: "kolambi masala prawn curry prawns masala jhinga", region: "Konkan & Malvani", serving: "1 katori (200 g)", servingG: 200, ingredients: [["prawns", 120], ["onion", 30], ["tomato", 20], ["coconut_fresh", 10], ["oil_sunflower", 10]], irritants: ["spicy", "tomato"] },
  { key: "bangda_fry", name: "Bangda fry", aliases: "bangda fry mackerel fry tava fry", region: "Konkan & Malvani", serving: "1 fish (130 g)", servingG: 130, ingredients: [["fish_oily", 120], ["rice_flour", 10], ["oil_sunflower", 10]], irritants: ["spicy"] },
  { key: "surmai_fry", name: "Surmai / pomfret fry", aliases: "surmai fry pomfret fry paplet fry rawas fry fish fry rava fry", region: "Konkan & Malvani", serving: "2 slices (130 g)", servingG: 130, ingredients: [["fish_lean", 120], ["rava", 10], ["oil_sunflower", 10]], irritants: ["spicy"] },
  { key: "malvani_fish_curry", name: "Malvani fish curry", aliases: "fish curry kalvan surmai curry pomfret curry machli", region: "Konkan & Malvani", serving: "1 katori (200 g)", servingG: 200, ingredients: [["fish_lean", 100], ["coconut_fresh", 25], ["onion", 20], ["tamarind", 3], ["oil_sunflower", 6]], irritants: ["spicy"] },
  { key: "kolambi_bhaat", name: "Kolambi bhaat (prawn pulao)", aliases: "kolambi bhat prawn rice prawn pulao", region: "Konkan & Malvani", serving: "1 plate (250 g)", servingG: 250, ingredients: [["rice_white", 60], ["prawns", 70], ["onion", 20], ["coconut_fresh", 8], ["oil_sunflower", 8]], irritants: ["spicy"] },
  { key: "amboli", name: "Amboli", aliases: "amboli konkani dosa", region: "Konkan & Malvani", serving: "2 amboli", servingG: 120, ingredients: [["rice_white", 40], ["urad", 10], ["oil_sunflower", 4]] },
  // ---- Fasting (upvas)
  { key: "sabudana_vada", name: "Sabudana vada", aliases: "sabudana wada sago vada upvas", region: "Fasting (upvas)", serving: "2 vadas (100 g)", servingG: 100, ingredients: [["sabudana", 30], ["potato", 40], ["peanuts", 12], ["oil_sunflower", 12]] },
  { key: "varai_bhaat", name: "Varai / bhagar bhaat", aliases: "varai bhat bhagar samo rice upvas", region: "Fasting (upvas)", serving: "1 plate (180 g)", servingG: 180, ingredients: [["vari", 50], ["peanuts", 8], ["ghee", 5], ["potato", 20]] },
  { key: "upvas_batata_bhaji", name: "Upvas batata bhaji", aliases: "upvasachi batata bhaji jeera aloo vrat", region: "Fasting (upvas)", serving: "1 katori (140 g)", servingG: 140, ingredients: [["potato", 130], ["peanuts", 10], ["ghee", 6]] },
  { key: "shengdana_amti", name: "Shengdana amti", aliases: "shengdanyachi amti peanut curry upvas", region: "Fasting (upvas)", serving: "1 katori (150 g)", servingG: 150, ingredients: [["peanuts", 25], ["ghee", 3], ["jaggery", 3]] },
  { key: "rajgira_thalipeeth", name: "Rajgira thalipeeth", aliases: "rajgira thalipith upvas thalipeeth", region: "Fasting (upvas)", serving: "1 thalipeeth", servingG: 90, ingredients: [["rajgira", 40], ["potato", 30], ["ghee", 5]] },
  { key: "rajgira_ladoo", name: "Rajgira ladoo", aliases: "rajgira ladoo ramdana laddu", region: "Fasting (upvas)", serving: "1 ladoo", servingG: 30, ingredients: [["rajgira", 15], ["jaggery", 12]] },
  { key: "ratalyacha_kees", name: "Ratalyacha kees (sweet potato)", aliases: "ratale kees sweet potato upvas shakarkand", region: "Fasting (upvas)", serving: "1 katori (150 g)", servingG: 150, ingredients: [["sweet_potato", 150], ["ghee", 6], ["peanuts", 8], ["sugar", 3]] },
  { key: "sabudana_kheer", name: "Sabudana kheer", aliases: "sabudana kheer sago kheer", region: "Fasting (upvas)", serving: "1 katori (180 g)", servingG: 180, ingredients: [["sabudana", 20], ["milk_whole", 150], ["sugar", 15]] },
  // ---- More South
  { key: "ven_pongal", name: "Ven pongal", aliases: "pongal khara pongal ven pongal", region: "South", serving: "1 bowl (200 g)", servingG: 200, ingredients: [["rice_white", 40], ["moong", 15], ["ghee", 8], ["cashews", 3]] },
  { key: "lemon_rice", name: "Lemon rice", aliases: "chitranna nimbu bhaat lemon rice", region: "South", serving: "1 plate (180 g)", servingG: 180, ingredients: [["rice_white", 55], ["peanuts", 8], ["oil_sunflower", 6], ["lemon_juice", 8], ["chana", 3]], irritants: ["citrus"] },
  { key: "puliyogare", name: "Tamarind rice (puliyogare)", aliases: "puliyogare puliodarai chinch bhaat tamarind rice", region: "South", serving: "1 plate (190 g)", servingG: 190, ingredients: [["rice_white", 55], ["tamarind", 8], ["peanuts", 8], ["oil_sunflower", 8], ["jaggery", 3], ["sesame", 2]], irritants: ["spicy"] },
  { key: "bisi_bele_bath", name: "Bisi bele bath", aliases: "bisibelebath sambar rice", region: "South", serving: "1 bowl (250 g)", servingG: 250, ingredients: [["rice_white", 35], ["toor", 20], ["carrot", 15], ["peas", 10], ["beans_french", 10], ["tamarind", 3], ["ghee", 6]], irritants: ["spicy"] },
  { key: "avial", name: "Avial", aliases: "aviyal avial", region: "South", serving: "1 katori (170 g)", servingG: 170, ingredients: [["carrot", 25], ["beans_french", 25], ["drumstick", 25], ["raw_banana", 25], ["pumpkin", 25], ["coconut_fresh", 20], ["curd", 20], ["oil_coconut", 5]] },
  { key: "cabbage_poriyal", name: "Cabbage poriyal", aliases: "poriyal thoran cabbage thoran", region: "South", serving: "1 katori (120 g)", servingG: 120, ingredients: [["cabbage", 120], ["coconut_fresh", 10], ["urad", 2], ["oil_coconut", 5]] },
  { key: "appam", name: "Appam", aliases: "appam palappam", region: "South", serving: "2 appams", servingG: 120, ingredients: [["rice_white", 45], ["coconut_fresh", 10], ["sugar", 3], ["oil_sunflower", 2]] },
  { key: "rava_dosa", name: "Rava dosa", aliases: "rava dosa sooji dosa", region: "South", serving: "1 dosa", servingG: 100, ingredients: [["rava", 20], ["rice_flour", 20], ["maida", 5], ["oil_sunflower", 8], ["onion", 10]] },
  { key: "moong_chilla", name: "Moong dal chilla / pesarattu", aliases: "moong chilla moong cheela pesarattu", region: "South", serving: "1 chilla (110 g)", servingG: 110, ingredients: [["moong", 40], ["onion", 10], ["oil_sunflower", 5]] },
  { key: "kerala_fish_curry", name: "Kerala fish curry (coconut)", aliases: "meen curry fish molee kerala fish curry", region: "South", serving: "1 katori (200 g)", servingG: 200, ingredients: [["fish_lean", 100], ["coconut_milk", 50], ["tamarind", 3], ["oil_coconut", 6], ["onion", 20]], irritants: ["spicy"] },
  // ---- More North
  { key: "aloo_matar", name: "Aloo matar", aliases: "aloo mutter batata vatana", region: "North", serving: "1 katori (160 g)", servingG: 160, ingredients: [["potato", 70], ["peas", 40], ["onion", 20], ["tomato", 30], ["oil_sunflower", 7]], irritants: ["tomato"] },
  { key: "matar_paneer", name: "Matar paneer", aliases: "mutter paneer", region: "North", serving: "1 katori (180 g)", servingG: 180, ingredients: [["paneer", 60], ["peas", 40], ["onion", 25], ["tomato", 40], ["oil_sunflower", 8]], irritants: ["tomato"] },
  { key: "paneer_butter_masala", name: "Paneer butter masala", aliases: "paneer makhani butter paneer", region: "North", serving: "1 katori (200 g)", servingG: 200, ingredients: [["paneer", 80], ["tomato", 60], ["butter", 10], ["cashews", 8], ["onion", 20], ["sugar", 3], ["oil_sunflower", 4]], irritants: ["tomato"] },
  { key: "kadhai_paneer", name: "Kadhai paneer", aliases: "kadai paneer", region: "North", serving: "1 katori (200 g)", servingG: 200, ingredients: [["paneer", 80], ["capsicum", 40], ["onion", 30], ["tomato", 40], ["oil_sunflower", 10]], irritants: ["tomato", "spicy"] },
  { key: "paneer_tikka", name: "Paneer tikka", aliases: "paneer tikka tandoori paneer", region: "North", serving: "6 pieces (170 g)", servingG: 170, ingredients: [["paneer", 100], ["capsicum", 30], ["onion", 30], ["curd", 20], ["oil_sunflower", 5]], irritants: ["spicy"] },
  { key: "chana_dal", name: "Chana dal", aliases: "chana dal fry harbhara dal", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["chana", 35], ["ghee", 5], ["onion", 15], ["tomato", 15]], irritants: ["tomato"] },
  { key: "moong_dal", name: "Moong dal", aliases: "moong dal yellow moong", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["moong", 30], ["ghee", 4], ["tomato", 10]] },
  { key: "masoor_dal", name: "Masoor dal", aliases: "masoor dal red lentil dal", region: "North", serving: "1 katori (150 g)", servingG: 150, ingredients: [["masoor", 30], ["ghee", 4], ["onion", 10], ["tomato", 15]], irritants: ["tomato"] },
  { key: "butter_chicken", name: "Butter chicken", aliases: "murgh makhani butter chicken", region: "North", serving: "1 katori (230 g)", servingG: 230, ingredients: [["chicken_curry_cut", 120], ["butter", 15], ["tomato", 60], ["cashews", 8], ["curd", 15], ["sugar", 3]], irritants: ["tomato"] },
  { key: "tandoori_chicken", name: "Tandoori chicken", aliases: "tandoori murgh chicken tikka", region: "North", serving: "1 quarter (160 g)", servingG: 160, ingredients: [["chicken_curry_cut", 200], ["curd", 20], ["oil_sunflower", 5], ["lemon_juice", 5]], irritants: ["spicy"] },
  { key: "chicken_biryani", name: "Chicken biryani", aliases: "chicken biryani murgh biryani dum biryani", region: "North", serving: "1 plate (350 g)", servingG: 350, ingredients: [["rice_white", 70], ["chicken_curry_cut", 100], ["onion", 40], ["curd", 20], ["ghee", 10], ["oil_sunflower", 5]], irritants: ["spicy"] },
  { key: "veg_biryani", name: "Veg biryani", aliases: "veg biryani vegetable biryani", region: "North", serving: "1 plate (300 g)", servingG: 300, ingredients: [["rice_white", 70], ["carrot", 20], ["peas", 15], ["beans_french", 15], ["potato", 30], ["onion", 30], ["curd", 15], ["ghee", 8], ["oil_sunflower", 4]], irritants: ["spicy"] },
  { key: "mutton_curry", name: "Mutton curry", aliases: "mutton masala gosht curry", region: "North", serving: "1 katori (220 g)", servingG: 220, ingredients: [["mutton", 120], ["onion", 40], ["tomato", 30], ["curd", 15], ["oil_sunflower", 12]], irritants: ["spicy", "tomato"] },
  { key: "keema_matar", name: "Keema matar", aliases: "keema mutter kheema", region: "North", serving: "1 katori (200 g)", servingG: 200, ingredients: [["mutton", 100], ["peas", 30], ["onion", 30], ["tomato", 30], ["oil_sunflower", 10]], irritants: ["spicy", "tomato"] },
  { key: "dahi_vada", name: "Dahi vada", aliases: "dahi bhalla dahi wada", region: "North", serving: "2 vadas (160 g)", servingG: 160, ingredients: [["urad", 30], ["oil_sunflower", 10], ["curd", 80], ["sugar", 3]] },
  { key: "gajar_halwa", name: "Gajar halwa", aliases: "gajar ka halwa carrot halwa", region: "Sweets", serving: "1 katori (150 g)", servingG: 150, ingredients: [["carrot", 120], ["milk_whole", 80], ["sugar", 18], ["ghee", 8], ["cashews", 3]] },
  { key: "gulab_jamun", name: "Gulab jamun", aliases: "gulab jamun", region: "Sweets", serving: "2 pieces (70 g)", servingG: 70, ingredients: [["khoya", 20], ["maida", 5], ["sugar", 22], ["oil_sunflower", 8]] },
  { key: "puri", name: "Puri", aliases: "puri poori", region: "Rice & breads", serving: "2 puris", servingG: 50, ingredients: [["atta", 30], ["oil_sunflower", 10]] },
  { key: "bhatura", name: "Bhatura", aliases: "bhatura bhature chole bhature", region: "Rice & breads", serving: "1 bhatura", servingG: 90, ingredients: [["maida", 60], ["curd", 10], ["oil_sunflower", 15]] },
  // ---- Gujarati, street food and East
  { key: "khandvi", name: "Khandvi", aliases: "khandvi suralichi vadi", region: "Gujarati & snacks", serving: "6 rolls (80 g)", servingG: 80, ingredients: [["besan", 25], ["curd", 30], ["oil_sunflower", 4], ["coconut_fresh", 3]] },
  { key: "handvo", name: "Handvo", aliases: "handvo", region: "Gujarati & snacks", serving: "1 piece (120 g)", servingG: 120, ingredients: [["rice_white", 20], ["toor", 8], ["chana", 8], ["lauki", 30], ["curd", 15], ["oil_sunflower", 8], ["sesame", 2]] },
  { key: "khakhra", name: "Khakhra", aliases: "khakhra", region: "Gujarati & snacks", serving: "1 khakhra", servingG: 18, ingredients: [["atta", 15], ["oil_sunflower", 2]] },
  { key: "bhel", name: "Bhel puri", aliases: "bhel bhelpuri bhel puri", region: "Street food", serving: "1 plate (120 g)", servingG: 120, ingredients: [["puffed_rice", 30], ["onion", 20], ["tomato", 15], ["potato", 25], ["besan", 8], ["tamarind", 5], ["jaggery", 5], ["oil_sunflower", 3]], irritants: ["spicy", "tomato"] },
  { key: "pani_puri", name: "Pani puri", aliases: "pani puri golgappa puchka", region: "Street food", serving: "6 puris", servingG: 150, ingredients: [["rava", 20], ["oil_sunflower", 8], ["potato", 30], ["chana", 10], ["tamarind", 5], ["jaggery", 5]], irritants: ["spicy"] },
  { key: "ragda_pattice", name: "Ragda pattice", aliases: "ragda patties ragda pattis", region: "Street food", serving: "1 plate (220 g)", servingG: 220, ingredients: [["peas_dried", 30], ["potato", 100], ["oil_sunflower", 10], ["onion", 15], ["tamarind", 3]], irritants: ["spicy"] },
  { key: "dabeli", name: "Dabeli", aliases: "kutchi dabeli", region: "Street food", serving: "1 dabeli", servingG: 140, ingredients: [["bread_white", 40], ["potato", 60], ["peanuts", 8], ["oil_sunflower", 5], ["jaggery", 5]], irritants: ["spicy"] },
  { key: "bombay_sandwich", name: "Bombay veg sandwich", aliases: "veg sandwich bombay sandwich", region: "Street food", serving: "1 sandwich (160 g)", servingG: 160, ingredients: [["bread_white", 60], ["butter", 8], ["cucumber", 30], ["tomato", 30], ["potato", 30]], irritants: ["tomato"] },
  { key: "macher_jhol", name: "Macher jhol (Bengali fish curry)", aliases: "macher jhol bengali fish curry", region: "East", serving: "1 katori (220 g)", servingG: 220, ingredients: [["fish_lean", 100], ["potato", 40], ["tomato", 20], ["oil_mustard", 8]], irritants: ["tomato"] },
  // ---- Eggs, salads & sides
  { key: "anda_bhurji", name: "Anda bhurji", aliases: "egg bhurji anda bhurji scrambled eggs", region: "Eggs, salads & sides", serving: "2 eggs (150 g)", servingG: 150, ingredients: [["egg", 100], ["onion", 30], ["tomato", 20], ["oil_sunflower", 8]], irritants: ["tomato"] },
  { key: "masala_omelette", name: "Masala omelette", aliases: "omelette amlet egg omelette", region: "Eggs, salads & sides", serving: "2 eggs (110 g)", servingG: 110, ingredients: [["egg", 100], ["onion", 15], ["oil_sunflower", 5]] },
  { key: "boiled_eggs", name: "Boiled eggs", aliases: "boiled egg ukadlela anda", region: "Eggs, salads & sides", serving: "2 eggs", servingG: 100, ingredients: [["egg", 100]] },
  { key: "raita", name: "Cucumber raita", aliases: "raita kakdi raita", region: "Eggs, salads & sides", serving: "1 katori (140 g)", servingG: 140, ingredients: [["curd", 100], ["cucumber", 40]] },
  { key: "plain_curd", name: "Dahi (plain curd)", aliases: "dahi curd yogurt", region: "Eggs, salads & sides", serving: "1 katori (100 g)", servingG: 100, ingredients: [["curd", 100]] },
  { key: "sprouts_salad", name: "Sprouts salad", aliases: "sprouts chaat moong salad", region: "Eggs, salads & sides", serving: "1 bowl (145 g)", servingG: 145, ingredients: [["moong_sprouts", 80], ["onion", 20], ["tomato", 20], ["cucumber", 20], ["lemon_juice", 5]], irritants: ["citrus"] },
  { key: "beetroot_koshimbir", name: "Beetroot koshimbir", aliases: "beet koshimbir beetroot raita", region: "Eggs, salads & sides", serving: "1 katori (120 g)", servingG: 120, ingredients: [["beetroot", 70], ["curd", 40], ["peanuts", 5]] },
  // ---- More drinks
  { key: "nimbu_pani", name: "Nimbu pani", aliases: "limbu sarbat nimbu sharbat lemonade shikanji", region: "Drinks", serving: "1 glass (250 ml)", servingG: 250, ingredients: [["lemon_juice", 20], ["sugar", 15], ["salt", 1]], irritants: ["citrus"] },
  { key: "kokum_sharbat", name: "Kokum sharbat", aliases: "kokum sarbat amsul", region: "Drinks", serving: "1 glass (250 ml)", servingG: 250, ingredients: [["sugar", 20]], irritants: ["citrus"] },
  { key: "aam_panha", name: "Aam panha", aliases: "kairi panha panna raw mango drink", region: "Drinks", serving: "1 glass (250 ml)", servingG: 250, ingredients: [["mango", 50], ["sugar", 20]], irritants: ["citrus"] },
  { key: "coconut_water", name: "Coconut water", aliases: "shahale nariyal pani tender coconut", region: "Drinks", serving: "1 coconut (250 ml)", servingG: 250, ingredients: [["coconut_water", 250]] },
  { key: "haldi_doodh", name: "Haldi doodh", aliases: "haldi milk turmeric milk halad dudh", region: "Drinks", serving: "1 glass (200 ml)", servingG: 205, ingredients: [["milk_whole", 200], ["sugar", 5]] },
  { key: "badam_milk", name: "Badam milk", aliases: "badam doodh almond milk", region: "Drinks", serving: "1 glass (220 ml)", servingG: 220, ingredients: [["milk_whole", 200], ["almonds", 10], ["sugar", 12]] },
  { key: "mango_lassi", name: "Mango lassi", aliases: "mango lassi", region: "Drinks", serving: "1 glass (250 ml)", servingG: 250, ingredients: [["curd", 150], ["mango", 80], ["sugar", 15]] },
  { key: "chai_no_sugar", name: "Chai (milk, no sugar)", aliases: "chai without sugar sugar free tea", region: "Drinks", serving: "1 cup (150 ml)", servingG: 150, ingredients: [["milk_whole", 75]], irritants: ["caffeine"] },
  { key: "sugarcane_juice", name: "Sugarcane juice", aliases: "usacha ras ganne ka ras sugarcane", region: "Drinks", serving: "1 glass (250 ml)", servingG: 250, ingredients: [["sugar", 45]] },
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
