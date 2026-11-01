/**
 * Every feature module the app knows about. A household switches modules on
 * or off (household_modules); only modules with status "available" have
 * screens today, the rest are listed so the roadmap is visible in Settings.
 *
 * `scope` says where a module's data lives:
 *  - "personal": owned by one person, private unless shared (module_shares)
 *  - "household": visible to every household member
 *  - "mixed": both kinds of rows
 */
export type ModuleScope = "personal" | "household" | "mixed";
export type ModuleStatus = "available" | "planned";

export type ModuleDef = {
  key: string;
  name: string;
  description: string;
  group: "Health" | "Food" | "Family & home" | "Leisure" | "Admin";
  scope: ModuleScope;
  status: ModuleStatus;
  phase: number;
  /** Health/intimate data: never shared unless the owner grants it. */
  sensitive?: boolean;
  /** Path of the module's main screen (available modules only). */
  href?: string;
  icon: string;
};

export const MODULES: ModuleDef[] = [
  {
    key: "medical_records",
    name: "Medical records",
    description: "Medical history, hospital papers and a timeline of illnesses, surgeries and medicines. Used as context for AI suggestions.",
    group: "Health",
    scope: "personal",
    status: "available",
    phase: 0,
    sensitive: true,
    href: "/medical",
    icon: "🩺",
  },
  { key: "medicines", name: "Medicines", description: "Prescriptions, schedules, stock and refill alerts.", group: "Health", scope: "personal", status: "available", phase: 1, href: "/medicines", sensitive: true, icon: "💊" },
  { key: "supplements", name: "Supplement stack", description: "Daily supplement checklist with adherence history.", group: "Health", scope: "personal", status: "available", phase: 1, href: "/supplements", icon: "🧴" },
  { key: "bladder_diary", name: "Bladder diary", description: "Leaks, urgency, fluids and triggers with doctor-ready reports.", group: "Health", scope: "personal", status: "available", phase: 1, href: "/bladder", sensitive: true, icon: "💧" },
  { key: "pelvic_floor", name: "Pelvic floor trainer", description: "Guided Kegel sessions and streaks.", group: "Health", scope: "personal", status: "available", phase: 1, href: "/pelvic-floor", sensitive: true, icon: "🧘" },
  { key: "checkin", name: "Daily check-in", description: "Sleep, mood, energy and stress in 10 seconds.", group: "Health", scope: "personal", status: "available", phase: 1, href: "/checkin", icon: "🌤️" },
  { key: "habits", name: "Habits", description: "Build and track daily habits.", group: "Health", scope: "personal", status: "available", phase: 1, href: "/habits", icon: "✅" },
  { key: "groceries", name: "Grocery list", description: "Shared, offline-ready grocery list.", group: "Food", scope: "household", status: "available", phase: 1, href: "/groceries", icon: "🛒" },
  { key: "food_diary", name: "Food diary", description: "Meals, calories and macros against goals.", group: "Food", scope: "personal", status: "planned", phase: 2, icon: "🍽️" },
  { key: "body_recomp", name: "Body recomposition", description: "Weight, milestones and trends.", group: "Health", scope: "personal", status: "planned", phase: 2, icon: "⚖️" },
  { key: "pantry", name: "Pantry & expiry", description: "Camera/receipt scanning with expiry estimates.", group: "Food", scope: "household", status: "planned", phase: 2, icon: "🥫" },
  { key: "recipes", name: "Recipes & meal plan", description: "Recipe vault and weekly planner that fills the grocery list.", group: "Food", scope: "household", status: "planned", phase: 2, icon: "📖" },
  { key: "fitness", name: "Fitness classes", description: "Gym, yoga and class schedule.", group: "Health", scope: "personal", status: "planned", phase: 3, icon: "🏋️" },
  { key: "child", name: "Child routine", description: "Naps, feeds, doses, vaccinations and growth.", group: "Family & home", scope: "household", status: "planned", phase: 3, icon: "👶" },
  { key: "maintenance", name: "Home maintenance", description: "AC filters, RO service, insurance renewals.", group: "Family & home", scope: "household", status: "planned", phase: 3, icon: "🛠️" },
  { key: "documents", name: "Document expiry", description: "Passports, visas, IDs and warranties.", group: "Admin", scope: "mixed", status: "planned", phase: 3, icon: "🛂" },
  { key: "subscriptions", name: "Subscriptions", description: "Active household subscriptions and renewals.", group: "Admin", scope: "household", status: "planned", phase: 3, icon: "🔁" },
  { key: "watchlist", name: "Couples' watchlist", description: "Shows, episodes and movie backlog.", group: "Leisure", scope: "household", status: "planned", phase: 4, icon: "🎬" },
  { key: "dining", name: "Takeout & dining vault", description: "Go-to orders and AI 'what to order'.", group: "Leisure", scope: "household", status: "planned", phase: 4, icon: "🍔" },
  { key: "travel", name: "Travel & packing", description: "Itineraries and reusable packing lists.", group: "Leisure", scope: "household", status: "planned", phase: 4, icon: "✈️" },
  { key: "occasions", name: "Occasions & gifts", description: "Birthdays, anniversaries and gift ideas.", group: "Family & home", scope: "household", status: "planned", phase: 4, icon: "🎁" },
];

export const MODULE_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m])) as Record<string, ModuleDef>;

export function isModuleKey(key: string): boolean {
  return key in MODULE_BY_KEY;
}

/** Modules whose data can be shared person-to-person. */
export const SHAREABLE_MODULES = MODULES.filter((m) => m.scope !== "household");
