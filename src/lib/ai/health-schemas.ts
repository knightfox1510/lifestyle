import { z } from "zod";

export const medicineCheckSchema = z.object({
  findings: z
    .array(
      z.object({
        severity: z.enum(["high", "medium", "info"]),
        title: z.string().min(1).max(120),
        detail: z.string().min(1).max(600),
        medicines: z.array(z.string().max(120)).max(8),
      }),
    )
    .max(12),
  questions_for_doctor: z.array(z.string().max(240)).max(6),
  note: z.string().max(400).nullable(),
});

export const visitSummarySchema = z.object({
  summary: z.string().max(1200).describe("A short, factual overview a doctor can read in 30 seconds"),
  changes: z.array(z.string().max(240)).max(8).describe("What changed since the period started: new symptoms, medicines, results"),
  questions: z.array(z.string().max(240)).max(8).describe("Questions the patient may want to ask"),
});
