/** Built-in packing templates (households can save their own too). */
export const BUILTIN_TEMPLATES: { key: string; name: string; items: { name: string; category: string; qty: number }[] }[] = [
  {
    key: "international",
    name: "International flight",
    items: [
      ["Passport", "documents"], ["Visa / e-visa printout", "documents"], ["Flight tickets & hotel bookings", "documents"], ["Travel insurance", "documents"],
      ["Forex card / cash", "money"], ["Credit cards", "money"], ["Universal adapter", "electronics"], ["Phone charger", "electronics"], ["Power bank (cabin bag)", "electronics"],
      ["Noise-cancelling headphones", "electronics"], ["Eye mask & neck pillow", "comfort"], ["Medicines + prescriptions", "health"], ["Pads / incontinence supplies", "health"],
      ["Toiletries (≤100 ml)", "toiletries"], ["Jacket", "clothes"], ["Comfortable walking shoes", "clothes"], ["Pen for immigration forms", "misc"],
    ].map(([name, category]) => ({ name, category, qty: 1 })),
  },
  {
    key: "weekend",
    name: "Weekend getaway",
    items: [
      ["ID card", "documents"], ["Phone charger", "electronics"], ["Power bank", "electronics"], ["2 sets of clothes", "clothes"], ["Sleepwear", "clothes"],
      ["Toiletries", "toiletries"], ["Sunscreen", "toiletries"], ["Medicines", "health"], ["Water bottle", "misc"], ["Snacks", "misc"],
    ].map(([name, category]) => ({ name, category, qty: 1 })),
  },
  {
    key: "camera",
    name: "Drone & camera gear",
    items: [
      ["Drone", "gear"], ["Drone batteries (all charged)", "gear"], ["Spare propellers", "gear"], ["Controller + cable", "gear"], ["ND filters", "gear"],
      ["Camera body", "gear"], ["Lenses", "gear"], ["SD cards (formatted)", "gear"], ["Card reader", "gear"], ["Lens cloth", "gear"], ["Drone permit / registration", "documents"],
    ].map(([name, category]) => ({ name, category, qty: 1 })),
  },
  {
    key: "beach",
    name: "Beach holiday",
    items: [
      ["Swimwear", "clothes"], ["Sunglasses", "accessories"], ["Hat", "accessories"], ["Sunscreen SPF 50", "toiletries"], ["After-sun / aloe", "toiletries"],
      ["Flip-flops", "clothes"], ["Beach towel", "misc"], ["Waterproof phone pouch", "electronics"], ["Insect repellent", "health"],
    ].map(([name, category]) => ({ name, category, qty: 1 })),
  },
];

export const ITEM_META = {
  idea: { label: "Idea", icon: "💡" },
  link: { label: "Link", icon: "🔗" },
  flight: { label: "Flight", icon: "✈️" },
  stay: { label: "Stay", icon: "🏨" },
  transport: { label: "Transport", icon: "🚆" },
  activity: { label: "Activity", icon: "🎟️" },
  food: { label: "Food", icon: "🍜" },
  note: { label: "Note", icon: "📝" },
} as const;
