export type Profile = {
  id: string;
  display_name: string;
  timezone: string;
  units: "metric" | "imperial";
  ai_use_medical_history: boolean;
  active_household_id: string | null;
};

export type Household = {
  id: string;
  name: string;
  created_by: string;
  ai_daily_limit: number;
  has_custom_ai_key: boolean;
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

export type ActionResult = { ok?: boolean; error?: string; message?: string };

// ------------------------------------------------------------- Phase 1 ----

export const MEDICINE_FORMS = ["tablet", "capsule", "syrup", "injection", "drops", "inhaler", "cream", "other"] as const;

export type Medicine = {
  id: string;
  owner_id: string;
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
};

// ------------------------------------------------------------- Phase 2 ----

export type LabFlag = "low" | "normal" | "high" | "abnormal";

export type LabResult = {
  id: string;
  owner_id: string;
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

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

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
  eaten_at: string;
  meal: Meal;
  description: string;
  quantity: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  source: "manual" | "ai_estimate" | "recipe" | "photo";
  recipe_id: string | null;
  notes: string | null;
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
};

export type RecipeIngredient = { name: string; quantity: string | null; category: GroceryCategory };

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
};
