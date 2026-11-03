export type Profile = {
  id: string;
  display_name: string;
  timezone: string;
  units: "metric" | "imperial";
  ai_use_medical_history: boolean;
  active_household_id: string | null;
  language: "en" | "hi" | "mr";
  /** Home hero: day arc (default), quiet bars or tiles. */
  home_view?: "arc" | "bars" | "tiles";
  /** Clock time per supplement timing (e.g. { morning: "07:30" }); defaults fill the rest. */
  supplement_times?: Record<string, string> | null;
};

export type Household = {
  id: string;
  name: string;
  created_by: string | null;
  ai_daily_limit: number;
  has_custom_ai_key: boolean;
  /** standard = Flash, best = Pro (missing on databases not yet updated). */
  ai_model?: "standard" | "best";
  shopping_day?: number;
};

export type MemberRole = "owner" | "member";

export type HouseholdMember = {
  user_id: string;
  role: MemberRole;
  joined_at: string;
  display_name: string;
};

export type ShareLevel = "read" | "write";

export type ModuleShare = {
  owner_id: string;
  grantee_id: string;
  module_key: string;
  level: ShareLevel;
};

export type HouseholdModule = {
  module_key: string;
  enabled: boolean;
  settings: Record<string, unknown>;
};

export type WidgetSize = "sm" | "md" | "lg";

export type UserWidget = {
  id: string;
  widget_key: string;
  position: number;
  size: WidgetSize;
  config: Record<string, unknown>;
};

export const MEDICAL_CATEGORIES = [
  "condition",
  "illness",
  "symptom",
  "injury",
  "surgery",
  "procedure",
  "hospitalization",
  "medication",
  "allergy",
  "vaccination",
  "test",
  "visit",
  "other",
] as const;
export type MedicalCategory = (typeof MEDICAL_CATEGORIES)[number];

export const SEVERITIES = ["mild", "moderate", "severe"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type MedicalEvent = {
  id: string;
  owner_id: string;
  created_by: string;
  household_id: string;
  category: MedicalCategory;
  title: string;
  details: string | null;
  start_date: string;
  end_date: string | null;
  ongoing: boolean;
  severity: Severity | null;
  dosage: string | null;
  frequency: string | null;
  related_event_id: string | null;
  document_id: string | null;
  source: "manual" | "ai_extracted";
  include_in_ai: boolean;
  created_at: string;
};

export const DOC_TYPES = [
  "lab_report",
  "health_checkup",
  "discharge_summary",
  "prescription",
  "imaging",
  "ecg",
  "pathology",
  "consultation",
  "vaccination",
  "dental",
  "eye",
  "insurance",
  "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export type MedicalDocument = {
  id: string;
  owner_id: string;
  created_by: string;
  household_id: string;
  title: string;
  doc_type: DocType;
  document_date: string | null;
  provider: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  notes: string | null;
  ai_summary: string | null;
  ai_extracted: unknown;
  ai_processed_at: string | null;
  include_in_ai: boolean;
  created_at: string;
};

export type MedicalProfile = {
  owner_id: string;
  date_of_birth: string | null;
  sex: "female" | "male" | "other" | null;
  blood_group: string | null;
  height_cm: number | null;
  notes: string | null;
  include_in_ai: boolean;
};

/** `id` is the created row, so a toast can offer Undo. */
export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string };

// ------------------------------------------------------------- Phase 1 ----

export const MEDICINE_FORMS = ["tablet", "capsule", "syrup", "injection", "drops", "inhaler", "cream", "other"] as const;

export type Medicine = {
  id: string;
  owner_id: string;
  created_by: string;
  household_id: string;
  name: string;
  strength: string | null;
  form: (typeof MEDICINE_FORMS)[number];
  dose_amount: number;
  dose_unit: string;
  instructions: string | null;
  times: string[];
  days_of_week: number[] | null;
  start_date: string;
  end_date: string | null;
  stock_count: number | null;
  refill_threshold: number | null;
  reason: string | null;
  prescribed_by: string | null;
  active: boolean;
  include_in_ai: boolean;
  /** Active ingredients as on the strip, e.g. "Calcium carbonate 1250 mg + Vitamin D3 250 IU". */
  ingredients?: string | null;
  /** Vitamins/minerals in ONE unit (tablet, capsule, ml); counted per dose taken. */
  nutrients?: Record<string, number> | null;
  /** Every N days from start_date (weekly = 7, monthly ≈ 30); null = by days_of_week. */
  repeat_every_days?: number | null;
};

export type MedicineDose = {
  id: string;
  medicine_id: string;
  owner_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: "taken" | "skipped";
  taken_at: string;
  logged_by: string;
};

export const SUPPLEMENT_TIMINGS = ["morning", "afternoon", "evening", "bedtime", "with_meal", "post_workout"] as const;
export type SupplementTiming = (typeof SUPPLEMENT_TIMINGS)[number];

export type Supplement = {
  id: string;
  owner_id: string;
  name: string;
  dose: string | null;
  timing: SupplementTiming;
  sort: number;
  stock_count: number | null;
  active: boolean;
  include_in_ai: boolean;
  /** Per one dose, app units (missing on databases not yet updated). */
  nutrients?: Record<string, number> | null;
  serving_label?: string | null;
  nutrients_source?: "manual" | "label" | "catalog" | null;
  /** How often (missing on databases not yet updated = every day). */
  days_of_week?: number[] | null;
  repeat_every_days?: number | null;
  schedule_start?: string | null;
};

export type SupplementLog = { supplement_id: string; owner_id: string; log_date: string; taken_at: string };

export const BLADDER_KINDS = ["leak", "urge", "void"] as const;
export const LEAK_AMOUNTS = ["drops", "small", "medium", "large"] as const;
export const BLADDER_TRIGGERS = [
  "cough",
  "sneeze",
  "laugh",
  "lifting",
  "exercise",
  "yoga",
  "running",
  "jumping",
  "standing_up",
  "bending",
  "urgency",
  "during_sleep",
  "cold",
  "stress",
  "other",
] as const;
export const DRINKS = ["water", "tea", "coffee", "milk", "juice", "soda", "alcohol", "electrolyte", "other"] as const;

export type BladderEvent = {
  id: string;
  owner_id: string;
  created_by?: string;
  occurred_at: string;
  kind: (typeof BLADDER_KINDS)[number];
  amount: (typeof LEAK_AMOUNTS)[number] | null;
  urgency: number | null;
  triggers: (typeof BLADDER_TRIGGERS)[number][];
  pad_changed: boolean;
  notes: string | null;
};

export type FluidIntake = {
  id: string;
  owner_id: string;
  created_by?: string;
  occurred_at: string;
  drink: (typeof DRINKS)[number];
  volume_ml: number;
  caffeinated: boolean;
};

export type PelvicFloorSession = {
  id: string;
  owner_id: string;
  performed_at: string;
  sets: number;
  reps: number;
  hold_seconds: number;
  relax_seconds: number;
  quick_flicks: number;
  completed: boolean;
  duration_seconds: number;
};

export type DailyCheckin = {
  owner_id: string;
  checkin_date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  notes: string | null;
};

export type Habit = {
  id: string;
  owner_id: string;
  name: string;
  icon: string;
  target_per_week: number;
  sort: number;
  active: boolean;
};

export type HabitLog = { habit_id: string; owner_id: string; log_date: string };

export const GROCERY_CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "bakery",
  "pantry",
  "frozen",
  "beverages",
  "snacks",
  "household",
  "personal_care",
  "baby",
  "other",
] as const;
export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export type GroceryItem = {
  id: string;
  household_id: string;
  created_by: string | null;
  name: string;
  quantity: string | null;
  category: GroceryCategory;
  notes: string | null;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** Why it's on the list when it came from the pantry. */
  reason?: "used_up" | "running_low" | "staple" | null;
  pantry_item_id?: string | null;
};

// ------------------------------------------------------------- Phase 2 ----

export type LabFlag = "low" | "normal" | "high" | "abnormal";

export type LabResult = {
  id: string;
  owner_id: string;
  created_by: string;
  document_id: string | null;
  test_date: string;
  panel: string | null;
  marker: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  flag: LabFlag | null;
  source: "manual" | "ai_extracted";
  include_in_ai: boolean;
};

export type Meal = "breakfast" | "lunch" | "dinner" | "snack" | "other";

export type NutritionGoals = {
  owner_id: string;
  goal: "lose" | "maintain" | "gain" | "recomp";
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  water_ml: number | null;
  diet_type: "any" | "vegetarian" | "eggetarian" | "vegan" | "jain" | "pescatarian" | "non_vegetarian";
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  cuisines: string[];
  cooking_style: "quick" | "balanced" | "elaborate" | "meal_prep";
  dislikes: string | null;
  rationale: string | null;
};

export type FoodEntry = {
  id: string;
  owner_id: string;
  created_by?: string;
  eaten_at: string;
  meal: Meal;
  description: string;
  quantity: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  source: "manual" | "ai_estimate" | "recipe" | "photo" | "restaurant";
  recipe_id: string | null;
  dish_id?: string | null;
  notes: string | null;
  micros?: Record<string, number> | null;
  grams?: number | null;
  accuracy?: "calculated" | "label" | "estimated";
  irritants?: string[];
  group_id?: string | null;
};

export type BodyMetric = {
  id: string;
  owner_id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  resting_hr: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  blood_glucose_mgdl: number | null;
  glucose_context: "fasting" | "post_meal" | "random" | null;
  notes: string | null;
};

export type BodyGoals = {
  owner_id: string;
  start_weight_kg: number | null;
  target_weight_kg: number | null;
  target_date: string | null;
  target_body_fat_pct: number | null;
  milestones: number[];
};

export type PantryLocation = "fridge" | "freezer" | "pantry";

export type PantryItem = {
  id: string;
  household_id: string;
  created_by: string | null;
  name: string;
  quantity: string | null;
  category: GroceryCategory;
  location: PantryLocation;
  purchased_on: string | null;
  expires_on: string | null;
  expiry_estimated: boolean;
  opened: boolean;
  notes: string | null;
  used_up_at: string | null;
  created_at: string;
  recipe_id?: string | null;
  portions?: number | null;
  staple?: boolean;
  running_low?: boolean;
};

export type FoodRef =
  | { kind: "staple"; key: string }
  | { kind: "custom"; id: string }
  | { kind: "usda"; id: string }
  | { kind: "recipe"; id: string }
  | { kind: "dish"; key: string };

export type RecipeIngredient = {
  name: string;
  quantity: string | null;
  category: GroceryCategory;
  /** Set by the nutrition calculator. */
  grams?: number | null;
  ref?: FoodRef | null;
  match_name?: string | null;
  per100?: Record<string, number> | null;
};

export type Recipe = {
  id: string;
  household_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source_url: string | null;
  ai_generated: boolean;
  favorite: boolean;
  updated_at: string;
  nutrition?: Record<string, number> | null;
  total_weight_g?: number | null;
  irritants?: string[];
};

export type MealPlanEntry = {
  id: string;
  household_id: string;
  plan_date: string;
  meal: Meal;
  recipe_id: string | null;
  title: string | null;
  servings: number;
  notes: string | null;
  for_user?: string | null;
  /** Servings per person, by user id (missing = 1). */
  portions?: Record<string, number> | null;
  kcal_per_serving?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  ingredients?: { name: string; quantity: string | null; category: GroceryCategory }[] | null;
  logged_at?: string | null;
};

// ------------------------------------------------------------- Phase 3 ----

export const WORKOUT_KINDS = ["gym", "yoga", "pilates", "swim", "run", "walk", "cycle", "dance", "sport", "class", "physio", "other"] as const;
export type WorkoutKind = (typeof WORKOUT_KINDS)[number];

export type FitnessClass = {
  id: string;
  owner_id: string;
  name: string;
  kind: WorkoutKind;
  days_of_week: number[];
  start_time: string;
  duration_minutes: number;
  location: string | null;
  instructor: string | null;
  remind_minutes_before: number | null;
  active: boolean;
  notes: string | null;
};

export type WorkoutLog = {
  id: string;
  owner_id: string;
  performed_on: string;
  class_id: string | null;
  kind: WorkoutKind;
  title: string;
  status: "done" | "skipped";
  duration_minutes: number | null;
  intensity: number | null;
  notes: string | null;
};

export type Dependent = {
  id: string;
  household_id: string;
  name: string;
  kind: "child" | "pet";
  date_of_birth: string | null;
  sex: "female" | "male" | "other" | null;
  notes: string | null;
};

export const CHILD_LOG_KINDS = ["feed", "sleep", "diaper", "medicine", "temperature", "milestone", "note"] as const;
export type ChildLog = {
  id: string;
  dependent_id: string;
  logged_by: string | null;
  kind: (typeof CHILD_LOG_KINDS)[number];
  started_at: string;
  ended_at: string | null;
  amount_ml: number | null;
  value: number | null;
  detail: string | null;
};

export type Vaccination = { id: string; dependent_id: string; vaccine: string; due_on: string | null; given_on: string | null; notes: string | null };
export type GrowthRecord = { id: string; dependent_id: string; measured_on: string; weight_kg: number | null; height_cm: number | null; head_cm: number | null };

export type MaintenanceTask = {
  id: string;
  household_id: string;
  title: string;
  category: "appliance" | "vehicle" | "home" | "insurance" | "health" | "other";
  interval_days: number | null;
  last_done_on: string | null;
  next_due_on: string | null;
  remind_days_before: number;
  vendor: string | null;
  notes: string | null;
};
export type MaintenanceLog = { id: string; task_id: string; done_on: string; done_by: string | null; cost: number | null; notes: string | null };

export const VAULT_DOC_TYPES = [
  "passport",
  "visa",
  "national_id",
  "driving_licence",
  "pan",
  "vehicle_rc",
  "vehicle_insurance",
  "health_insurance",
  "life_insurance",
  "home_insurance",
  "warranty",
  "lease",
  "membership",
  "other",
] as const;
export type VaultDocument = {
  id: string;
  owner_id: string;
  household_id: string;
  scope: "personal" | "household";
  title: string;
  doc_type: (typeof VAULT_DOC_TYPES)[number];
  holder: string | null;
  number_last4: string | null;
  issued_on: string | null;
  expires_on: string | null;
  remind_days_before: number;
  notes: string | null;
};

export const SUB_CATEGORIES = ["streaming", "music", "food", "shopping", "utilities", "software", "fitness", "news", "cloud", "other"] as const;
export const BILLING_CYCLES = ["weekly", "monthly", "quarterly", "half_yearly", "yearly"] as const;
export type Subscription = {
  id: string;
  household_id: string;
  name: string;
  category: (typeof SUB_CATEGORIES)[number];
  cost: number | null;
  currency: string;
  billing_cycle: (typeof BILLING_CYCLES)[number];
  next_renewal_on: string | null;
  paid_by: string | null;
  auto_renew: boolean;
  url: string | null;
  notes: string | null;
  active: boolean;
};

export type NotificationPrefs = {
  user_id: string;
  medicines: boolean;
  fitness: boolean;
  expiries: boolean;
  renewals: boolean;
  maintenance: boolean;
  child: boolean;
  digest: boolean;
  occasions: boolean;
  travel: boolean;
  water: boolean;
  water_target_ml: number | null;
  water_interval_min: number;
  water_start: string;
  water_end: string;
  close_day: boolean;
  close_day_time: string;
  partner_updates: boolean;
  daily_hour: number;
  quiet_start: string | null;
  quiet_end: string | null;
};

// ------------------------------------------------------------- Phase 4 ----

export type WatchItem = {
  id: string;
  household_id: string;
  added_by: string | null;
  title: string;
  kind: "series" | "movie" | "documentary" | "anime" | "other";
  platform: string | null;
  status: "want" | "watching" | "paused" | "finished" | "dropped";
  together: boolean;
  total_seasons: number | null;
  notes: string | null;
  updated_at: string;
};
export type WatchProgress = { item_id: string; user_id: string; season: number; episode: number; rating: number | null; updated_at: string };

export type DiningPlace = {
  id: string;
  household_id: string;
  name: string;
  cuisine: string | null;
  area: string | null;
  mode: "delivery" | "dine_in" | "both";
  order_via: string | null;
  favorite: boolean;
  notes: string | null;
};
export type DiningDish = {
  id: string;
  place_id: string;
  name: string;
  section: string | null;
  description: string | null;
  price: number | null;
  veg: boolean | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  nutrition_estimated: boolean;
  source: "manual" | "menu_import";
  go_to_for: string[];
  notes: string | null;
};
export type DiningOrder = { id: string; place_id: string | null; ordered_by: string | null; ordered_on: string; items: string; total: number | null; rating: number | null; notes: string | null };

export const TRIP_ITEM_KINDS = ["idea", "link", "flight", "stay", "transport", "activity", "food", "note"] as const;
export type Trip = {
  id: string;
  household_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "idea" | "planning" | "booked" | "done";
  budget: number | null;
  currency: string;
  notes: string | null;
};
export type TripItem = {
  id: string;
  trip_id: string;
  day_date: string | null;
  kind: (typeof TRIP_ITEM_KINDS)[number];
  title: string;
  url: string | null;
  start_time: string | null;
  location: string | null;
  cost: number | null;
  booked: boolean;
  notes: string | null;
};
export type PackingItem = { id: string; trip_id: string; name: string; category: string; qty: number; for_user: string | null; packed: boolean };
export type PackingTemplate = { id: string; name: string; items: { name: string; category: string; qty: number }[] };

export type Occasion = {
  id: string;
  household_id: string;
  title: string;
  kind: "birthday" | "anniversary" | "festival" | "other";
  month: number;
  day: number;
  year: number | null;
  recurring: boolean;
  person: string | null;
  remind_days_before: number;
  notes: string | null;
};
export type GiftIdea = { id: string; occasion_id: string | null; for_person: string; idea: string; url: string | null; price: number | null; status: "idea" | "bought" | "given"; notes: string | null };

export type WearableDay = {
  id: string;
  owner_id: string;
  day: string;
  source: "manual" | "csv" | "webhook" | "health_connect";
  steps: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  sleep_minutes: number | null;
  deep_sleep_minutes: number | null;
  active_minutes: number | null;
  calories_burned: number | null;
  hrv_ms: number | null;
};

export type CustomFood = {
  id: string;
  household_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: "manual" | "label" | "openfoodfacts" | "usda";
  serving_g: number | null;
  serving_label: string | null;
  nutrients: Record<string, number>;
  irritants: string[];
  notes: string | null;
};
