/** Every screen worth finding by name, with words people might type (pure; used by the search page). */
import { MODULES } from "@/modules/registry";

export type PageEntry = { href: string; title: string; hint: string; module: string | null; words: string };

const PAGES: PageEntry[] = [
  { href: "/", title: "Today", hint: "Your day, goals and what's next", module: null, words: "home dashboard rings" },
  { href: "/food/plan", title: "Week plan", hint: "Plan meals for the week, shopping day, portions", module: "food_diary", words: "meal plan weekly menu shopping" },
  { href: "/food/goals", title: "Nutrition goals", hint: "Calories, protein, carbs, fat, water", module: "food_diary", words: "macros target diet calories" },
  { href: "/food/report", title: "Weekly food report", hint: "How the week went against your goals", module: "food_diary", words: "nutrition summary" },
  { href: "/food/foods", title: "My foods", hint: "Saved foods and packaged products", module: "food_diary", words: "custom foods" },
  { href: "/food/product", title: "Scan a packaged food", hint: "Barcode or nutrition label", module: "food_diary", words: "barcode label scan" },
  { href: "/food/dishes", title: "Indian dishes", hint: "Built-in dishes with nutrition", module: "food_diary", words: "dosa poha dal sabzi" },
  { href: "/food/ideas", title: "Meal ideas", hint: "AI ideas from your pantry and goals", module: "food_diary", words: "suggestions what to cook" },
  { href: "/body", title: "Body numbers", hint: "Weight, BMI, waist, healthy range, calories to maintain", module: "body_recomp", words: "bmi weight height waist maintenance bmr" },
  { href: "/medicines/manage", title: "Add or edit medicines", hint: "Doses, times, stock", module: "medicines", words: "prescription tablet" },
  { href: "/medicines/history", title: "Medicine history", hint: "Adherence over time", module: "medicines", words: "missed doses" },
  { href: "/medicines/checks", title: "Medicine safety checks", hint: "Interactions, duplicates, timing", module: "medicines", words: "interaction" },
  { href: "/medical/labs", title: "Blood work & labs", hint: "Results and trends", module: "medical_records", words: "blood test report vitamin d b12 hba1c thyroid" },
  { href: "/medical/documents", title: "Medical papers", hint: "Upload and read reports with AI", module: "medical_records", words: "discharge summary prescription upload" },
  { href: "/medical/visit", title: "Doctor visit summary", hint: "One page for your doctor", module: "medical_records", words: "appointment" },
  { href: "/medical/profile", title: "Medical profile", hint: "Height, blood group, date of birth", module: "medical_records", words: "height blood group allergies" },
  { href: "/bladder/trends", title: "Bladder trends & triggers", hint: "Daily and weekly leaks, what sets them off", module: "bladder_diary", words: "leaks weekly trend caffeine" },
  { href: "/bladder/report", title: "Bladder diary report", hint: "For your doctor or physio", module: "bladder_diary", words: "doctor physio" },
  { href: "/bladder/import", title: "Import a WhatsApp log", hint: "Leaks from a chat export", module: "bladder_diary", words: "whatsapp import" },
  { href: "/pantry/scan", title: "Scan groceries into the pantry", hint: "Photo of a bill or shelf", module: "pantry", words: "bill receipt photo" },
  { href: "/recipes/new", title: "New recipe", hint: "Add a recipe", module: "recipes", words: "cook" },
  { href: "/digest/wrap", title: "Your week", hint: "Streaks, doses, water and cheers", module: null, words: "weekly wrap summary" },
  { href: "/assistant", title: "Ask AI", hint: "Questions about your health, food and plans", module: null, words: "chat assistant gemini" },
  { href: "/customize", title: "Home widgets", hint: "Extra cards under your day", module: null, words: "customise dashboard" },
  { href: "/settings", title: "Settings", hint: "Language, Home view, profile", module: null, words: "language hindi marathi" },
  { href: "/settings/times", title: "Supplement times", hint: "When morning, with a meal, bedtime… mean for you", module: "supplements", words: "timing schedule reminder time" },
  { href: "/settings/features", title: "My features", hint: "Hide what you don't use", module: null, words: "turn off hide disable" },
  { href: "/settings/sharing", title: "Sharing", hint: "What your partner can see or edit", module: null, words: "privacy partner access" },
  { href: "/settings/notifications", title: "Notifications & reminders", hint: "Push, water and dose reminders", module: null, words: "remind alerts push" },
  { href: "/settings/household", title: "Household", hint: "Members, invites, features, AI key", module: null, words: "invite partner gemini key" },
  { href: "/settings/privacy", title: "Privacy & data", hint: "Export or delete your data", module: null, words: "export delete account" },
];

export function pageIndex(): PageEntry[] {
  const modules: PageEntry[] = MODULES.filter((m) => m.href && m.status === "available").map((m) => ({ href: m.href!, title: m.name, hint: m.description, module: m.key, words: m.key.replace(/_/g, " ") }));
  return [...modules, ...PAGES];
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9ऀ-ॿ ]/g, " ");

/** Pages matching every typed word (in the title, hint or keywords); title matches first. */
export function searchPages(entries: PageEntry[], query: string, limit = 8): PageEntry[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return entries
    .map((e) => {
      const title = norm(e.title);
      const all = `${title} ${norm(e.hint)} ${norm(e.words)}`;
      if (!words.every((w) => all.includes(w))) return null;
      const score = words.reduce((a, w) => a + (title.startsWith(w) ? 3 : title.includes(w) ? 2 : 1), 0);
      return { e, score };
    })
    .filter((x): x is { e: PageEntry; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.e.title.length - b.e.title.length)
    .slice(0, limit)
    .map((x) => x.e);
}
