import type { GroceryCategory } from "@/lib/types";

export const CATEGORY_META: Record<GroceryCategory, { label: string; icon: string }> = {
  produce: { label: "Fruit & veg", icon: "🥦" },
  dairy: { label: "Dairy & eggs", icon: "🥛" },
  meat: { label: "Meat & fish", icon: "🍗" },
  bakery: { label: "Bakery", icon: "🍞" },
  pantry: { label: "Pantry", icon: "🥫" },
  frozen: { label: "Frozen", icon: "🧊" },
  beverages: { label: "Drinks", icon: "🧃" },
  snacks: { label: "Snacks", icon: "🍪" },
  household: { label: "Household", icon: "🧽" },
  personal_care: { label: "Personal care", icon: "🧴" },
  baby: { label: "Baby", icon: "🍼" },
  other: { label: "Other", icon: "🛒" },
};

const KEYWORDS: [GroceryCategory, string[]][] = [
  ["produce", ["apple", "banana", "onion", "tomato", "potato", "spinach", "palak", "lettuce", "carrot", "lemon", "lime", "ginger", "garlic", "coriander", "chilli", "chili", "mango", "orange", "grape", "cucumber", "capsicum", "pepper", "broccoli", "cabbage", "cauliflower", "beans", "peas", "avocado", "berries", "fruit", "veg", "methi", "mint", "okra", "bhindi", "brinjal", "mushroom"]],
  ["dairy", ["milk", "curd", "dahi", "yogurt", "yoghurt", "paneer", "cheese", "butter", "ghee", "cream", "egg", "eggs", "tofu"]],
  ["meat", ["chicken", "mutton", "fish", "prawn", "shrimp", "beef", "pork", "salmon", "tuna", "meat", "keema"]],
  ["bakery", ["bread", "bun", "pav", "roti", "naan", "cake", "croissant", "bagel", "tortilla"]],
  ["pantry", ["rice", "atta", "flour", "dal", "lentil", "oil", "salt", "sugar", "spice", "masala", "pasta", "noodle", "oats", "cereal", "sauce", "ketchup", "jam", "honey", "besan", "poha", "rava", "suji", "chana", "rajma", "nuts", "almond", "peanut", "vinegar", "whey", "protein"]],
  ["frozen", ["frozen", "ice cream", "peas frozen"]],
  ["beverages", ["coffee", "tea", "juice", "soda", "water", "coke", "beer", "wine", "kombucha"]],
  ["snacks", ["chips", "biscuit", "cookie", "chocolate", "namkeen", "popcorn", "bar"]],
  ["household", ["detergent", "soap", "dish", "tissue", "toilet paper", "garbage", "bin bag", "cleaner", "foil", "cling", "sponge", "bulb", "battery"]],
  ["personal_care", ["shampoo", "conditioner", "toothpaste", "toothbrush", "deodorant", "razor", "sunscreen", "lotion", "pad", "pads", "tampon", "floss"]],
  ["baby", ["diaper", "nappy", "wipes", "formula", "baby"]],
];

/** Best-effort category from the item name (user can change it). */
export function guessCategory(name: string): GroceryCategory {
  const n = name.toLowerCase();
  for (const [cat, words] of KEYWORDS) {
    if (words.some((w) => new RegExp(`\\b${w}`).test(n))) return cat;
  }
  return "other";
}
