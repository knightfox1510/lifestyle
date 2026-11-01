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
  "discharge_summary",
  "prescription",
  "lab_report",
  "imaging",
  "consultation",
  "vaccination",
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
