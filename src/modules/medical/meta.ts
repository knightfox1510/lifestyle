import type { DocType, MedicalCategory } from "@/lib/types";

export const CATEGORY_META: Record<MedicalCategory, { label: string; icon: string }> = {
  condition: { label: "Condition", icon: "🩺" },
  illness: { label: "Illness", icon: "🤒" },
  symptom: { label: "Symptom", icon: "🌡️" },
  injury: { label: "Injury", icon: "🩹" },
  surgery: { label: "Surgery", icon: "🏥" },
  procedure: { label: "Procedure", icon: "🔬" },
  hospitalization: { label: "Hospital stay", icon: "🛏️" },
  medication: { label: "Medication", icon: "💊" },
  allergy: { label: "Allergy", icon: "⚠️" },
  vaccination: { label: "Vaccination", icon: "💉" },
  test: { label: "Test / result", icon: "🧪" },
  visit: { label: "Doctor visit", icon: "👩‍⚕️" },
  other: { label: "Other", icon: "📝" },
};

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  discharge_summary: "Discharge summary",
  prescription: "Prescription",
  lab_report: "Lab report",
  imaging: "Imaging / scan",
  consultation: "Consultation note",
  vaccination: "Vaccination record",
  insurance: "Insurance / claim",
  other: "Other",
};

export function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatRange(start: string, end: string | null, ongoing: boolean) {
  if (ongoing) return `Since ${formatDate(start)} · ongoing`;
  if (end && end !== start) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start);
}
