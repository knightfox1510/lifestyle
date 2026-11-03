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
  // Fruits common in India (USDA SR Legacy, raw edible portion).
  ["guava", "Guava (pink or white)", "guava peru amrood amrud pink guava", [68, 2.6, 14.3, 1, 5.4, 8.9, 0.3, 2, 417, 18, 0.3, 22, 0.2, 31, 228.3, 0, 0, 49]],
  ["pomegranate", "Pomegranate", "pomegranate anar dalimb dalimba", [83, 1.7, 18.7, 1.2, 4, 13.7, 0.1, 3, 236, 10, 0.3, 12, 0.4, 0, 10.2, 0, 0, 38]],
  ["watermelon", "Watermelon", "watermelon tarbooz kalingad", [30, 0.6, 7.6, 0.2, 0.4, 6.2, 0, 1, 112, 7, 0.2, 10, 0.1, 28, 8.1, 0, 0, 3]],
  ["muskmelon", "Muskmelon", "muskmelon kharbuja kharbooja cantaloupe", [34, 0.8, 8.2, 0.2, 0.9, 7.9, 0.1, 16, 267, 9, 0.2, 12, 0.2, 169, 36.7, 0, 0, 21]],
  ["grapes", "Grapes", "grapes angoor draksha", [69, 0.7, 18.1, 0.2, 0.9, 15.5, 0.1, 2, 191, 10, 0.4, 7, 0.1, 3, 3.2, 0, 0, 2]],
  ["pineapple", "Pineapple", "pineapple ananas", [50, 0.5, 13.1, 0.1, 1.4, 9.9, 0, 1, 109, 13, 0.3, 12, 0.1, 3, 47.8, 0, 0, 18], ["citrus"]],
  ["chikoo", "Chikoo (sapodilla)", "chikoo chiku sapota sapodilla", [83, 0.4, 20, 1.1, 5.3, null, 0.2, 12, 193, 21, 0.8, 12, 0.1, 3, 14.7, 0, 0, 14]],
  ["pear", "Pear", "pear nashpati", [57, 0.4, 15.2, 0.1, 3.1, 9.8, 0, 1, 116, 9, 0.2, 7, 0.1, 1, 4.3, 0, 0, 7]],
  ["custard_apple", "Custard apple (sitaphal)", "sitaphal sharifa custard apple sugar apple", [94, 2.1, 23.6, 0.3, 4.4, null, 0, 9, 247, 24, 0.6, 21, 0.1, 0, 36.3, 0, 0, 14]],
  ["jackfruit", "Jackfruit (ripe)", "jackfruit phanas kathal", [95, 1.7, 23.3, 0.6, 1.5, 19.1, 0.2, 2, 448, 24, 0.2, 29, 0.1, 5, 13.7, 0, 0, 24]],
  ["strawberry", "Strawberries", "strawberry strawberries", [32, 0.7, 7.7, 0.3, 2, 4.9, 0, 1, 153, 16, 0.4, 13, 0.1, 1, 58.8, 0, 0, 24]],
  ["kiwi", "Kiwi", "kiwi kiwifruit", [61, 1.1, 14.7, 0.5, 3, 9, 0, 3, 312, 34, 0.3, 17, 0.1, 4, 92.7, 0, 0, 25]],
  ["almond_milk", "Almond milk, unsweetened (per 100 ml)", "almond milk unsweetened badam milk plant milk", [15, 0.6, 0.6, 1.1, 0.2, 0, 0.1, 72, 67, 184, 0.3, 6, null, null, 0, 1, null, null]],
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
  // More Indian vegetables, grains, fasting (upvas) foods, seafood and meat.
  ["sweet_potato", "Sweet potato (ratale)", "ratale shakarkand sweet potato rataalu", [86, 1.6, 20.1, 0.1, 3, 4.2, 0, 55, 337, 30, 0.6, 25, 0.3, 709, 2.4, 0, 0, 11]],
  ["methi", "Fenugreek leaves (methi)", "methi fenugreek leaves methichi bhaji", [49, 4.4, 6, 0.9, 4.9, null, null, 76, 31, 395, 1.9, 67, 0.5, 195, 52, 0, 0, 57]],
  ["drumstick", "Drumstick pods (shevga)", "shevga shevgyachya shenga moringa drumstick sahjan", [37, 2.1, 8.5, 0.2, 3.2, null, 0, 42, 461, 30, 0.4, 45, 0.5, 4, 141, 0, 0, 44]],
  ["pumpkin", "Pumpkin, red (lal bhopla)", "bhopla lal bhopla kaddu pumpkin", [26, 1, 6.5, 0.1, 0.5, 2.8, 0.1, 1, 340, 21, 0.8, 12, 0.3, 426, 9, 0, 0, 16]],
  ["raw_banana", "Raw banana / plantain", "kacha kela raw banana plantain kele", [122, 1.3, 31.9, 0.4, 2.3, 15, 0.1, 4, 499, 3, 0.6, 37, 0.1, 56, 18.4, 0, 0, 22]],
  ["karela", "Bitter gourd (karela)", "karela karle bitter gourd", [17, 1, 3.7, 0.2, 2.8, null, 0, 5, 296, 19, 0.4, 17, 0.8, 24, 84, 0, 0, 72]],
  ["dodka", "Ridge gourd (dodka / turai)", "dodka turai tori ridge gourd", [20, 1.2, 4.4, 0.2, 1.1, null, 0, 3, 139, 20, 0.4, 14, 0.1, 25, 12, 0, 0, 7]],
  ["tondli", "Ivy gourd (tondli / tindora)", "tondli tondali tindora kundru ivy gourd", [18, 1.2, 3.1, 0.1, 1.6, null, null, null, null, 40, 0.4, null, null, null, 1.4, 0, 0, null]],
  ["beans_french", "French beans", "farasbi french beans green beans", [31, 1.8, 7, 0.2, 2.7, 3.3, 0, 6, 211, 37, 1, 25, 0.2, 35, 12.2, 0, 0, 33]],
  ["beetroot", "Beetroot", "beet beetroot chukandar", [43, 1.6, 9.6, 0.2, 2.8, 6.8, 0, 78, 325, 16, 0.8, 23, 0.4, 2, 4.9, 0, 0, 109]],
  ["radish", "Radish (mula)", "mula mooli radish", [16, 0.7, 3.4, 0.1, 1.6, 1.9, 0, 39, 233, 25, 0.3, 10, 0.3, 0, 14.8, 0, 0, 25]],
  ["amaranth_leaves", "Amaranth leaves (chawli / lal math)", "chawli leaves lal math rajgira leaves chaulai amaranth leaves", [23, 2.5, 4, 0.3, null, null, 0.1, 20, 611, 215, 2.3, 55, 0.9, 146, 43.3, 0, 0, 85]],
  ["corn", "Sweet corn kernels", "makka bhutta corn sweet corn", [86, 3.3, 18.7, 1.4, 2, 6.3, 0.3, 15, 270, 2, 0.5, 37, 0.5, 9, 6.8, 0, 0, 42]],
  ["moong_sprouts", "Sprouted moong", "moong sprouts modachi mung sprouts ankurit", [30, 3, 5.9, 0.2, 1.8, 4.1, 0, 6, 149, 13, 0.9, 21, 0.4, 1, 13.2, 0, 0, 61]],
  ["chawli", "Black-eyed beans (chawli / lobia, raw)", "chawli lobia cowpea black eyed beans", [336, 23.5, 60, 1.3, 10.6, 6.9, 0.3, 16, 1112, 110, 8.3, 184, 3.4, 2, 1.5, 0, 0, 633]],
  ["peas_dried", "Dried peas (kala / white vatana, raw)", "vatana kala vatana dried peas safed vatana ragda", [364, 23.1, 61.6, 3.9, 22.2, 8, 0.5, 15, 981, 46, 3.9, 70, 3.6, 7, 1.8, 0, 0, 274]],
  ["val", "Field beans (val / dalimbi, raw)", "val dalimbi vaal lablab field beans", [344, 23.9, 60.7, 1.7, 25.6, null, 0.4, 21, 1235, 130, 5.1, 283, 9.3, 0, 0, 0, 0, null]],
  ["rice_flour", "Rice flour", "tandul pith rice flour chawal ka atta", [366, 6, 80.1, 1.4, 2.4, 0.1, 0.4, 0, 76, 10, 0.4, 35, 0.8, 0, 0, 0, 0, 4]],
  ["puffed_rice", "Puffed rice (kurmura / murmura)", "kurmura murmura churmuri puffed rice mamra", [402, 6.3, 89.8, 0.5, 1.7, 0.1, 0.1, 4, 113, 6, null, 25, 1.2, 0, 0, 0, 0, 3]],
  ["rajgira", "Amaranth grain / flour (rajgira)", "rajgira ramdana amaranth", [371, 13.6, 65.3, 7, 6.7, 1.7, 1.5, 4, 508, 159, 7.6, 248, 2.9, 0, 4.2, 0, 0, 82]],
  ["vari", "Barnyard millet (vari / bhagar / samo)", "vari varai bhagar samo sama rice barnyard millet", [307, 6.2, 65.5, 2.2, 9.8, null, null, null, null, 20, 5, null, null, 0, 0, 0, 0, null]],
  ["sesame", "Sesame seeds (til)", "til tilgul sesame", [573, 17.7, 23.4, 49.7, 11.8, 0.3, 7, 11, 468, 975, 14.6, 351, 7.8, 0, 0, 0, 0, 97]],
  ["dry_coconut", "Dry coconut (khobra / desiccated)", "khobra kopra suka nariyal dry coconut desiccated", [660, 6.9, 23.7, 64.5, 16.3, 7.4, 57.2, 37, 543, 26, 3.3, 90, 2, 0, 1.5, 0, 0, 9]],
  ["coconut_milk", "Coconut milk", "naralache dudh nariyal doodh coconut milk", [230, 2.3, 5.5, 23.8, 2.2, 3.3, 21.1, 15, 263, 16, 1.6, 37, 0.7, 0, 2.8, 0, 0, 16]],
  ["coconut_water", "Coconut water", "shahale tender coconut water nariyal pani", [19, 0.7, 3.7, 0.2, 1.1, 2.6, 0.2, 105, 250, 24, 0.3, 25, 0.1, 0, 2.4, 0, 0, 3]],
  ["raisins", "Raisins (kismis)", "kismis manuka raisins", [299, 3.1, 79.2, 0.5, 3.7, 59.2, 0.1, 11, 749, 50, 1.9, 32, 0.2, 0, 2.3, 0, 0, 5]],
  ["khoya", "Khoya / mawa", "khoya khawa mawa", [421, 14.6, 20.5, 31.2, 0, null, null, null, null, null, null, null, null, null, null, null, null, null]],
  ["bread_white", "Bread / pav (white)", "pav pao bread bun ladi pav", [266, 7.6, 50.6, 3.3, 2.4, 5.7, 0.7, 490, 115, 151, 3.7, 23, 0.7, 0, 0, 0, 0, 111]],
  ["chicken_curry_cut", "Chicken, curry cut (skinless leg/thigh, raw)", "chicken curry cut chicken leg thigh kombdi", [120, 19.3, 0, 4.2, 0, 0, 1.1, 95, 240, 11, 1, 22, 2, 20, 0, 0.1, 0.5, 8]],
  ["fish_lean", "Fish, lean (surmai / pomfret / rawas, raw)", "surmai pomfret paplet rawas kingfish fish machli masa", [105, 20.3, 0, 2, 0, 0, 0.4, 158, 435, 32, 1.8, 32, 0.5, 75, 1.6, null, 15, 9]],
  ["fish_oily", "Fish, oily (bangda / mackerel, raw)", "bangda mackerel tarli sardine oily fish", [205, 18.6, 0, 13.9, 0, 0, 3.3, 90, 314, 12, 1.6, 76, 0.6, 50, 0.4, 16.1, 8.7, 1]],
  ["prawns", "Prawns / shrimp (raw)", "kolambi jhinga prawns shrimp", [85, 20.1, 0, 0.5, 0, 0, 0.1, 119, 264, 64, 0.2, 22, 1.1, 0, 0, 0, 1.1, 19]],
  // Everyday additions (per 100 g; USDA SR Legacy / IFCT 2017 averages, rounded). Unknown micros are left out.
  // Pulses, grains and cereals.
  ["kala_chana", "Black chickpeas (kala chana, raw)", "kala chana harbhara black chana bengal gram whole", [360, 20.5, 60.2, 5.1, 17.1, null, 0.5, 24, 875, 105, 6.2, 138, 3.4, 3, 1, 0, 0, 557]],
  ["kulith", "Horse gram (kulith / kulthi, raw)", "kulith kulthi horse gram hulga", [321, 21.7, 57.2, 0.6, 7.9, null, null, null, null, 269, 8.8, null, null, null, 1, 0, 0, null]],
  ["soybean", "Soybeans (raw)", "soybean soya bean", [446, 36.5, 30.2, 19.9, 9.3, 7.3, 2.9, 2, 1797, 277, 15.7, 280, 4.9, 1, 6, 0, 0, 375]],
  ["dalia", "Broken wheat (dalia, raw)", "dalia daliya broken wheat lapsi bulgur", [342, 12.3, 75.9, 1.3, 18.3, 0.4, 0.2, 17, 410, 35, 2.5, 164, 1.9, 0, 0, 0, 0, 27]],
  ["vermicelli", "Vermicelli (seviyan, raw)", "shevaya seviyan vermicelli semiya", [354, 12, 74.7, 1.5, 3.2, 2.7, 0.3, 6, 223, 21, 1.3, 53, 1.4, 0, 0, 0, 0, 18]],
  ["pasta", "Pasta (dry)", "pasta penne macaroni spaghetti", [371, 13, 74.7, 1.5, 3.2, 2.7, 0.3, 6, 223, 21, 1.3, 53, 1.4, 0, 0, 0, 0, 18]],
  ["noodles_instant", "Instant noodles (dry, with tastemaker)", "maggi instant noodles ramen yippee", [436, 9.5, 63.4, 16.5, 2.4, 2.3, 7.4, 1160, 150, 20, 4.3, 25, 0.6, 0, 0, 0, 0, 120]],
  ["quinoa", "Quinoa (raw)", "quinoa", [368, 14.1, 64.2, 6.1, 7, null, 0.7, 5, 563, 47, 4.6, 197, 3.1, 1, 0, 0, 0, 184]],
  ["cornflakes", "Cornflakes", "cornflakes corn flakes cereal", [357, 7.5, 84.1, 0.4, 3.3, 9.5, 0.1, 729, 168, 5, 28.9, 39, 0.3, 500, 0, 3.6, 1.5, 357]],
  ["muesli", "Muesli (no added sugar)", "muesli granola", [363, 10.4, 66.2, 6.2, 7.3, 14, 1, 20, 400, 50, 3.5, 100, 2.5, 0, 0, 0, 0, 40]],
  ["bread_brown", "Bread, brown / whole wheat", "brown bread whole wheat bread atta bread multigrain", [252, 12.5, 42.7, 3.5, 6, 4.4, 0.7, 450, 250, 161, 2.5, 76, 1.8, 0, 0, 0, 0, 42]],
  ["makhana", "Fox nuts (makhana)", "makhana phool makhana lotus seeds fox nuts", [347, 9.7, 76.9, 0.1, 14.5, null, null, 1, 500, 60, 1.4, 56, null, 0, 0, 0, 0, null]],
  // Dairy and alternatives.
  ["milk_skim", "Milk, skimmed", "skim milk skimmed milk fat free milk", [34, 3.4, 5, 0.1, 0, 5.1, 0.1, 42, 156, 122, 0, 11, 0.4, 61, 0, 1.2, 0.5, 5]],
  ["milk_buffalo", "Milk, buffalo", "buffalo milk mhashiche dudh bhains", [97, 3.8, 5.2, 6.9, 0, 5.2, 4.6, 52, 178, 169, 0.1, 31, 0.2, 53, 2.3, null, 0.36, 6]],
  ["buttermilk", "Buttermilk (chaas, plain)", "chaas taak mattha buttermilk", [25, 1.5, 2.2, 1, 0, 2.2, 0.6, 105, 75, 60, 0, 6, 0.2, 10, 0.3, 0, 0.1, 3]],
  ["greek_yogurt", "Greek yogurt / hung curd (plain)", "greek yogurt hung curd chakka", [97, 9, 4, 5, 0, 4, 2.4, 35, 141, 100, 0, 11, 0.5, 30, 0, 0, 0.75, 7]],
  ["cheese", "Cheese (processed / slice)", "cheese slice processed cheese amul cheese cheddar", [328, 18, 6, 26, 0, 3, 16, 1300, 140, 600, 0.3, 25, 2.5, 200, 0, 0.3, 0.8, 7]],
  ["cream", "Fresh cream (≈25% fat)", "malai fresh cream amul cream", [242, 2.5, 3.5, 25, 0, 3.5, 15.6, 38, 103, 90, 0, 9, 0.3, 200, 0.6, 0.4, 0.2, 4]],
  ["tofu", "Tofu (firm)", "tofu soya paneer bean curd", [144, 15.8, 2.8, 8.7, 2.3, 0.6, 1.3, 14, 237, 683, 2.7, 58, 1.6, 8, 0.2, 0, 0, 29]],
  ["soy_milk", "Soy milk (unsweetened)", "soy milk soya milk", [33, 2.9, 1.7, 1.6, 0.4, 0.5, 0.2, 51, 122, 123, 0.4, 16, 0.3, 50, 0, 1.1, 1.1, 9]],
  ["oat_milk", "Oat milk (unsweetened)", "oat milk", [46, 1, 6.7, 1.5, 0.8, 4, 0.2, 42, 160, 120, 0.3, 10, null, null, 0, 1.1, 0.4, null]],
  ["ice_cream", "Ice cream (vanilla)", "ice cream kulfi", [207, 3.5, 23.6, 11, 0.7, 21.2, 6.8, 80, 199, 128, 0.1, 14, 0.7, 118, 0.6, 0.2, 0.4, 5]],
  // Vegetables and greens.
  ["dill", "Dill leaves (shepu / suva)", "shepu suva dill sowa", [43, 3.5, 7, 1.1, 2.1, null, 0.1, 61, 738, 208, 6.6, 55, 0.9, 386, 85, 0, 0, 150]],
  ["gavar", "Cluster beans (gavar)", "gavar guar cluster beans gawar", [47, 3.2, 10.8, 0.4, 3.2, null, null, null, null, 130, 1.1, null, null, null, 49, 0, 0, null]],
  ["arbi", "Colocasia root (arbi)", "arbi alu arvi colocasia taro", [112, 1.5, 26.5, 0.2, 4.1, 0.4, 0, 11, 591, 43, 0.6, 33, 0.2, 4, 4.5, 0, 0, 22]],
  ["arbi_leaves", "Colocasia leaves (alu)", "alu leaves aluchi pane alu vadi colocasia leaves patra", [42, 5, 6.7, 0.7, 3.7, 3, 0.2, 3, 648, 107, 2.3, 45, 0.4, 241, 52, 0, 0, 126]],
  ["suran", "Elephant foot yam (suran)", "suran jimikand yam elephant foot", [118, 1.5, 27.9, 0.2, 4.1, 0.5, 0, 9, 816, 17, 0.5, 21, 0.2, 7, 17.1, 0, 0, 23]],
  ["spring_onion", "Spring onion (green onion)", "spring onion kanda paat green onion scallion", [32, 1.8, 7.3, 0.2, 2.6, 2.3, 0, 16, 276, 72, 1.5, 20, 0.4, 50, 18.8, 0, 0, 64]],
  ["broccoli", "Broccoli", "broccoli", [34, 2.8, 6.6, 0.4, 2.6, 1.7, 0, 33, 316, 47, 0.7, 21, 0.4, 31, 89.2, 0, 0, 63]],
  ["zucchini", "Zucchini", "zucchini courgette", [17, 1.2, 3.1, 0.3, 1, 2.5, 0.1, 8, 261, 16, 0.4, 18, 0.3, 10, 17.9, 0, 0, 24]],
  ["lettuce", "Lettuce", "lettuce salad leaves", [15, 1.4, 2.9, 0.2, 1.3, 0.8, 0, 28, 194, 36, 0.9, 13, 0.2, 370, 9.2, 0, 0, 38]],
  ["capsicum_red", "Capsicum (red / yellow)", "red capsicum yellow capsicum bell pepper", [31, 1, 6, 0.3, 2.1, 4.2, 0, 4, 211, 7, 0.4, 12, 0.3, 157, 127.7, 0, 0, 46]],
  ["turnip", "Turnip (shalgam)", "turnip shalgam", [28, 0.9, 6.4, 0.1, 1.8, 3.8, 0, 67, 191, 30, 0.3, 11, 0.3, 0, 21, 0, 0, 15]],
  ["tinda", "Round gourd (tinda)", "tinda round gourd", [21, 1.4, 3.4, 0.2, 1, null, null, null, null, 25, 0.9, null, null, null, 18, 0, 0, null]],
  ["green_peas_frozen", "Green peas (frozen)", "frozen peas matar frozen", [77, 5.2, 13.6, 0.4, 4.5, 4.7, 0.1, 108, 153, 22, 1.5, 21, 0.7, 103, 18, 0, 0, 59]],
  ["mint", "Mint leaves (pudina)", "pudina mint", [44, 3.3, 8.4, 0.7, 6.8, null, 0.2, 31, 569, 243, 5.1, 80, 1.1, 212, 31.8, 0, 0, 114]],
  ["curry_leaves", "Curry leaves (kadipatta)", "kadipatta kadhi patta curry leaves", [108, 6.1, 18.7, 1, 6.4, null, null, null, null, 830, 0.9, null, null, null, 4, 0, 0, null]],
  // Fruits.
  ["litchi", "Litchi", "litchi lychee", [66, 0.8, 16.5, 0.4, 1.3, 15.2, 0.1, 1, 171, 5, 0.3, 10, 0.1, 0, 71.5, 0, 0, 14]],
  ["plum", "Plum", "plum aloo bukhara", [46, 0.7, 11.4, 0.3, 1.4, 9.9, 0, 0, 157, 6, 0.2, 7, 0.1, 17, 9.5, 0, 0, 5]],
  ["peach", "Peach", "peach aadu", [39, 0.9, 9.5, 0.3, 1.5, 8.4, 0, 0, 190, 6, 0.3, 9, 0.2, 16, 6.6, 0, 0, 4]],
  ["fig_fresh", "Fig (fresh)", "anjeer fresh fig", [74, 0.8, 19.2, 0.3, 2.9, 16.3, 0.1, 1, 232, 35, 0.4, 17, 0.2, 7, 2, 0, 0, 6]],
  ["fig_dried", "Fig (dried anjeer)", "anjeer dried fig", [249, 3.3, 63.9, 0.9, 9.8, 47.9, 0.1, 10, 680, 162, 2, 68, 0.6, 0, 1.2, 0, 0, 9]],
  ["amla", "Amla (Indian gooseberry)", "amla awla avla indian gooseberry", [44, 0.9, 10.2, 0.6, 4.3, null, null, 1, 198, 25, 0.3, 10, 0.1, 15, 252, 0, 0, 6], ["citrus"]],
  ["jamun", "Jamun", "jamun java plum black plum", [60, 0.7, 15.6, 0.2, 0.6, null, null, 14, 79, 19, 0.2, 15, null, 3, 14.3, 0, 0, null]],
  ["mosambi", "Sweet lime (mosambi)", "mosambi sweet lime", [43, 0.8, 9.3, 0.3, 0.5, 8, 0, 2, 150, 40, 0.7, 10, null, 0, 50, 0, 0, null], ["citrus"]],
  ["avocado", "Avocado", "avocado butter fruit", [160, 2, 8.5, 14.7, 6.7, 0.7, 2.1, 7, 485, 12, 0.6, 29, 0.6, 7, 10, 0, 0, 81]],
  ["blueberries", "Blueberries", "blueberry blueberries", [57, 0.7, 14.5, 0.3, 2.4, 10, 0, 1, 77, 6, 0.3, 6, 0.2, 3, 9.7, 0, 0, 6]],
  ["apricot_dried", "Apricots (dried)", "jardalu dried apricot khubani", [241, 3.4, 62.6, 0.5, 7.3, 53.4, 0, 10, 1162, 55, 2.7, 32, 0.4, 180, 1, 0, 0, 10]],
  ["prunes", "Prunes", "prunes dried plums", [240, 2.2, 63.9, 0.4, 7.1, 38.1, 0.1, 2, 732, 43, 0.9, 41, 0.4, 39, 0.6, 0, 0, 4]],
  // Nuts and seeds.
  ["pistachios", "Pistachios", "pista pistachio", [560, 20.2, 27.2, 45.3, 10.6, 7.7, 5.9, 1, 1025, 105, 3.9, 121, 2.2, 26, 5.6, 0, 0, 51]],
  ["chia", "Chia seeds", "chia seeds", [486, 16.5, 42.1, 30.7, 34.4, 0, 3.3, 16, 407, 631, 7.7, 335, 4.6, 0, 1.6, 0, 0, 49]],
  ["pumpkin_seeds", "Pumpkin seeds", "pumpkin seeds magaj", [559, 30.2, 10.7, 49, 6, 1.4, 8.7, 7, 809, 46, 8.8, 592, 7.8, 1, 1.9, 0, 0, 58]],
  ["sunflower_seeds", "Sunflower seeds", "sunflower seeds", [584, 20.8, 20, 51.5, 8.6, 2.6, 4.5, 9, 645, 78, 5.3, 325, 5, 3, 1.4, 0, 0, 227]],
  ["peanut_butter", "Peanut butter", "peanut butter pintola peanut butter", [588, 25.1, 20, 50.4, 6, 9.2, 10.3, 459, 649, 43, 1.9, 154, 2.9, 0, 0, 0, 0, 92]],
  ["chikki", "Peanut chikki", "chikki gud chikki groundnut chikki", [500, 13, 55, 26, 4, null, null, null, null, 50, 2, null, null, 0, 0, 0, 0, null]],
  // Non-veg.
  ["egg_white", "Egg white", "egg white anda safedi", [52, 10.9, 0.7, 0.2, 0, 0.7, 0, 166, 163, 7, 0.1, 11, 0, 0, 0, 0, 0.09, 4]],
  ["chicken_keema", "Chicken mince (keema, raw)", "chicken keema chicken mince", [143, 17.4, 0, 8.1, 0, 0, 2.3, 60, 522, 6, 0.8, 21, 1.5, 22, 0.4, 0.1, 0.6, 6]],
  ["mutton_keema", "Mutton mince (keema, raw)", "mutton keema kheema mince", [282, 16.6, 0, 23.4, 0, 0, 10.2, 59, 222, 16, 1.6, 21, 3.4, 0, 0, 0.1, 2.3, 19]],
  ["tuna_canned", "Tuna, canned in water", "tuna canned tuna", [86, 19.4, 0, 1, 0, 0, 0.2, 247, 179, 14, 0.8, 23, 0.5, 6, 0, 1.7, 1.2, 4]],
  ["crab", "Crab (raw)", "khekda crab kekda", [87, 18.1, 0, 1.1, 0, 0, 0.2, 293, 329, 89, 0.7, 49, 3.5, 2, 3, 0, 9, 44]],
  // Snacks, sweets and packaged foods.
  ["biscuit_marie", "Marie / glucose biscuits", "marie biscuit parle g glucose biscuit good day", [445, 7, 75, 13, 2, 22, 6, 380, 120, 40, 2, 15, null, 0, 0, 0, 0, null]],
  ["namkeen", "Namkeen / sev / bhujia", "namkeen sev bhujia farsan chivda mixture", [540, 15, 45, 34, 6, 2, 10, 900, 400, 50, 3, 60, null, 0, 0, 0, 0, null]],
  ["potato_chips", "Potato chips", "potato chips wafers lays", [536, 7, 53, 34.6, 4.4, 0.3, 10.9, 525, 1196, 21, 1.6, 67, 1.1, 0, 21, 0, 0, 75]],
  ["papad", "Papad (roasted)", "papad papadum", [371, 25.6, 59.9, 3.3, 18.6, null, 1, 1745, 1000, 104, 7.6, 266, null, 0, 0, 0, 0, null]],
  ["pickle", "Pickle (achaar, oil-based)", "achaar lonche pickle mango pickle", [180, 1.5, 7, 16, 3, 2, 2, 2500, 100, 30, 1, 15, null, 30, 5, 0, 0, null], ["spicy"]],
  ["ketchup", "Tomato ketchup", "ketchup tomato sauce", [101, 1, 27.4, 0.1, 0.3, 21.3, 0, 907, 281, 15, 0.4, 13, 0.2, 26, 4.1, 0, 0, 9], ["tomato"]],
  ["mayonnaise", "Mayonnaise", "mayo mayonnaise", [680, 1, 0.6, 74.9, 0, 0.6, 11.7, 635, 20, 8, 0.2, 1, 0.1, 22, 0, 0.2, 0.1, 5]],
  ["gulab_jamun_pc", "Gulab jamun (with syrup)", "gulab jamun", [323, 4.4, 50, 12, 0.5, 40, 6, null, null, 60, 0.5, null, null, null, 0, 0, 0, null]],
  ["rasgulla", "Rasgulla (with syrup)", "rasgulla rosogolla", [186, 4, 40, 1.6, 0, 38, 1, null, null, 50, 0.3, null, null, null, 0, 0, 0, null]],
  ["jalebi", "Jalebi", "jalebi", [415, 2.5, 66, 16, 0.4, 50, 6, null, null, 15, 1, null, null, 0, 0, 0, 0, null]],
  ["barfi", "Barfi / peda (milk)", "barfi burfi peda kaju katli", [420, 9, 55, 18, 0.5, 45, 11, null, null, 200, 0.5, null, null, null, 0, 0, 0, null]],
  // Drinks (per 100 ml).
  ["cola", "Cola / soft drink (per 100 ml)", "cola coke pepsi thums up soft drink cold drink", [42, 0, 10.6, 0, 0, 10.6, 0, 4, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0], ["carbonated", "caffeine"]],
  ["juice_orange", "Orange juice (per 100 ml)", "orange juice mosambi juice", [45, 0.7, 10.4, 0.2, 0.2, 8.4, 0, 1, 200, 11, 0.2, 11, 0.1, 10, 50, 0, 0, 30], ["citrus"]],
  ["sugarcane_juice", "Sugarcane juice (per 100 ml)", "sugarcane juice ganna ras usacha ras", [73, 0.2, 18, 0.1, 0, 17, 0, 10, 150, 10, 0.4, 10, null, 0, 1, 0, 0, null]],
  ["beer", "Beer (per 100 ml)", "beer", [43, 0.5, 3.6, 0, 0, 0, 0, 4, 27, 4, 0, 6, 0, 0, 0, 0, 0, 6], ["alcohol", "carbonated"]],
  ["wine", "Wine (per 100 ml)", "wine red wine white wine", [83, 0.1, 2.6, 0, 0, 0.6, 0, 5, 127, 8, 0.5, 12, 0.1, 0, 0, 0, 0, 1], ["alcohol"]],
  ["spirits", "Whisky / rum / vodka (per 100 ml)", "whisky whiskey rum vodka gin daru peg", [231, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0], ["alcohol"]],
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
