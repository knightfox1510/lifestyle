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

const amount = (max: number) => z.number().min(0).max(max).nullable();
export const supplementLabelSchema = z.object({
  name: z.string().min(1).max(120),
  serving_label: z.string().max(40).nullable().describe("One dose as printed, e.g. '1 tablet', '1 sachet', '1 scoop (30 g)'"),
  per_serving: z.object({
    vit_d_mcg: amount(10000).describe("Vitamin D in micrograms (IU ÷ 40)"),
    b12_mcg: amount(100000),
    iron_mg: amount(1000).describe("ELEMENTAL iron, not the salt weight"),
    calcium_mg: amount(5000).describe("ELEMENTAL calcium"),
    folate_mcg: amount(20000).describe("Folic acid in micrograms (1 mg = 1000 mcg)"),
    zinc_mg: amount(500).describe("Elemental zinc"),
    magnesium_mg: amount(2000).describe("Elemental magnesium"),
    vit_c_mg: amount(10000),
    vit_a_mcg: amount(10000).describe("Vitamin A as µg RAE (retinol IU × 0.3)"),
    calories: amount(2000),
    protein_g: amount(200),
  }),
  other: z.string().max(300).nullable().describe("Other actives worth knowing (e.g. omega-3 EPA/DHA, biotin), as short text"),
});

