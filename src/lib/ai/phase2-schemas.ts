import { z } from "zod";
import { BLADDER_TRIGGERS, DRINKS, GROCERY_CATEGORIES, LEAK_AMOUNTS } from "@/lib/types";

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const foodItemSchema = z.object({
  description: z.string().min(1).max(200).describe("Food name as a person would say it, e.g. '2 phulka rotis'"),
  quantity: z.string().max(60).nullable(),
  calories: z.number().int().min(0).max(5000),
  protein_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(500),
  fiber_g: z.number().min(0).max(200),
});
export type FoodItem = z.infer<typeof foodItemSchema>;

export const foodEstimateSchema = z.object({
  meal: z.enum(MEALS).describe("Best guess of the meal slot from the description/time"),
  items: z.array(foodItemSchema).max(20),
  note: z.string().max(400).nullable().describe("Short caveat about the estimate, if any"),
});

export const ingredientSchema = z.object({
  name: z.string().min(1).max(80),
  quantity: z.string().max(60).nullable(),
  category: z.enum(GROCERY_CATEGORIES),
  in_pantry: z.boolean().describe("True if the household already has it according to the pantry list"),
});

export const mealIdeaSchema = z.object({
  title: z.string().min(1).max(150),
  why: z.string().max(400).describe("Why this fits their goals, health data and what they have"),
  servings: z.number().int().min(1).max(12),
  prep_minutes: z.number().int().min(0).max(600),
  cook_minutes: z.number().int().min(0).max(600),
  calories_per_serving: z.number().int().min(0).max(3000),
  protein_g: z.number().min(0).max(300),
  carbs_g: z.number().min(0).max(500),
  fat_g: z.number().min(0).max(300),
  ingredients: z.array(ingredientSchema).max(30),
  steps: z.array(z.string().max(400)).max(20),
  tags: z.array(z.string().max(30)).max(8),
});
export type MealIdea = z.infer<typeof mealIdeaSchema>;
export const mealIdeasSchema = z.object({ ideas: z.array(mealIdeaSchema).min(1).max(4) });

export const nutritionGoalSchema = z.object({
  calories: z.number().int().min(1000).max(5000),
  protein_g: z.number().int().min(20).max(350),
  carbs_g: z.number().int().min(20).max(700),
  fat_g: z.number().int().min(20).max(250),
  fiber_g: z.number().int().min(10).max(80),
  water_ml: z.number().int().min(1000).max(5000),
  rationale: z.string().max(1500).describe("3-5 sentences: maintenance estimate, deficit/surplus, protein logic, health adjustments"),
});

export const scanItemSchema = z.object({
  name: z.string().min(1).max(120).describe("Generic product name, e.g. 'Amul milk 1L' or 'Tomatoes'"),
  quantity: z.string().max(40).nullable(),
  category: z.enum(GROCERY_CATEGORIES),
  location: z.enum(["fridge", "freezer", "pantry"]),
  expires_in_days: z.number().int().min(0).max(1095).nullable().describe("Printed expiry if visible, else a typical shelf life once bought"),
  expiry_printed: z.boolean(),
});
export type ScanItem = z.infer<typeof scanItemSchema>;
export const scanSchema = z.object({ items: z.array(scanItemSchema).max(80), note: z.string().max(300).nullable() });

/** Natural-language quick log ("2 coffees, small leak during squats at 7:40, weighed 63.8"). */
export const quickLogSchema = z.object({
  food: z.array(foodItemSchema.extend({ meal: z.enum(MEALS), time: z.string().regex(/^\d{2}:\d{2}$/).nullable() })).max(15),
  drinks: z.array(z.object({ drink: z.enum(DRINKS), volume_ml: z.number().int().min(10).max(3000), caffeinated: z.boolean(), time: z.string().regex(/^\d{2}:\d{2}$/).nullable() })).max(15),
  bladder: z.array(z.object({
    kind: z.enum(["leak", "urge", "void"]),
    amount: z.enum(LEAK_AMOUNTS).nullable(),
    urgency: z.number().int().min(1).max(5).nullable(),
    triggers: z.array(z.enum(BLADDER_TRIGGERS)).max(6),
    time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  })).max(15),
  weight_kg: z.number().min(20).max(350).nullable(),
  unrecognised: z.string().max(300).nullable().describe("Anything that couldn't be mapped"),
});
export type QuickLog = z.infer<typeof quickLogSchema>;

export const labResultSchema = z.object({
  test_date: isoDate,
  panel: z.string().max(100).nullable().describe("e.g. Lipid profile, CBC, Thyroid profile"),
  marker: z.string().min(1).max(120).describe("Standard marker name, e.g. 'HbA1c', 'Vitamin D (25-OH)', 'TSH'"),
  value: z.number().nullable(),
  value_text: z.string().max(120).nullable().describe("Only for non-numeric results like 'Negative'"),
  unit: z.string().max(40).nullable(),
  ref_low: z.number().nullable(),
  ref_high: z.number().nullable(),
  ref_text: z.string().max(120).nullable(),
  flag: z.enum(["low", "normal", "high", "abnormal"]).nullable(),
});
export type LabResultInput = z.infer<typeof labResultSchema>;
