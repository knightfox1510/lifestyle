import { z } from "zod";
import { MEDICAL_CATEGORIES, SEVERITIES } from "@/lib/types";
import { labResultSchema } from "@/lib/ai/phase2-schemas";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const extractedEventSchema = z.object({
  category: z.enum(MEDICAL_CATEGORIES),
  title: z.string().min(1).max(200),
  details: z.string().max(1500).nullable(),
  start_date: isoDate,
  end_date: isoDate.nullable(),
  ongoing: z.boolean(),
  severity: z.enum(SEVERITIES).nullable(),
  dosage: z.string().max(120).nullable(),
  frequency: z.string().max(120).nullable(),
});
export type ExtractedEvent = z.infer<typeof extractedEventSchema>;

export const medicalExtractionSchema = z.object({
  summary: z
    .string()
    .describe("3-6 sentence plain-language summary: diagnosis, procedures, key results, discharge advice."),
  document_date: isoDate.nullable().describe("Main date of the document, if visible."),
  provider: z.string().nullable().describe("Hospital, clinic or doctor name, if visible."),
  events: z
    .array(extractedEventSchema)
    .describe(
      "Timeline entries found in the document: diagnoses (condition/illness), surgeries, procedures, hospital stays, every prescribed medication with dose and frequency, allergies, vaccinations. Use the document date when an entry has no own date. Do NOT repeat individual lab values here.",
    ),
  lab_results: z
    .array(labResultSchema)
    .max(150)
    .describe(
      "Every measured lab/test value in the document (blood work, urine, thyroid, lipids, vitamins, etc.) with unit and reference range exactly as printed. Flag using the printed range. Empty if none.",
    ),
});
export type MedicalExtraction = z.infer<typeof medicalExtractionSchema>;

/** JSON schema for Gemini's responseJsonSchema. */
export function toGeminiSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}
