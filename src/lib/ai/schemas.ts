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

type Json = Record<string, unknown>;

/** The original JSON schema of a zod schema (with every limit still in it). */
function rawJsonSchema(schema: z.ZodType): Json {
  const json = z.toJSONSchema(schema) as Json;
  delete json.$schema;
  return json;
}

/**
 * Gemini rejects schemas whose arrays carry item limits ("Request contains
 * an invalid argument", 400): the limits blow up its constrained-decoding
 * grammar. They are moved into the description instead; `clampToSchema`
 * then trims any over-long list before zod validation.
 */
function relaxForGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(relaxForGemini);
  if (!node || typeof node !== "object") return node;
  const out: Json = {};
  for (const [k, v] of Object.entries(node as Json)) {
    if (k === "maxItems" || k === "minItems") continue;
    if (k === "properties" && v && typeof v === "object") {
      out[k] = Object.fromEntries(Object.entries(v as Json).map(([pk, pv]) => [pk, relaxForGemini(pv)]));
    } else out[k] = relaxForGemini(v);
  }
  const { maxItems, minItems } = node as { maxItems?: number; minItems?: number };
  const hint = [minItems ? `At least ${minItems} item${minItems === 1 ? "" : "s"}.` : "", typeof maxItems === "number" ? `At most ${maxItems} items.` : ""].filter(Boolean).join(" ");
  if (hint) out.description = [out.description, hint].filter(Boolean).join(" ");
  return out;
}

/** JSON schema for Gemini's responseJsonSchema. */
export function toGeminiSchema(schema: z.ZodType) {
  return relaxForGemini(rawJsonSchema(schema)) as Json;
}

function clampNode(value: unknown, node: unknown): unknown {
  if (!node || typeof node !== "object" || value == null) return value;
  const n = node as { maxItems?: number; items?: unknown; properties?: Json; anyOf?: unknown[] };
  if (Array.isArray(value)) {
    const list = typeof n.maxItems === "number" ? value.slice(0, n.maxItems) : value;
    if (n.items) return list.map((v) => clampNode(v, n.items));
    if (n.anyOf) return clampNode(list, n.anyOf.find((o) => (o as Json)?.type === "array"));
    return list;
  }
  if (typeof value === "object") {
    if (n.properties) {
      const obj = value as Json;
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, n.properties![k] ? clampNode(v, n.properties![k]) : v]));
    }
    if (n.anyOf) return clampNode(value, n.anyOf.find((o) => (o as Json)?.type === "object"));
  }
  return value;
}

/** Trims lists in an AI answer to the schema's item limits (which Gemini can't be given directly). */
export function clampToSchema<T>(value: T, schema: z.ZodType): T {
  return clampNode(value, rawJsonSchema(schema)) as T;
}
