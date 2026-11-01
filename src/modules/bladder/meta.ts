import type { BladderEvent, FluidIntake } from "@/lib/types";

export const KIND_META: Record<BladderEvent["kind"], { label: string; icon: string }> = {
  leak: { label: "Leak", icon: "💧" },
  urge: { label: "Urge", icon: "⚡" },
  void: { label: "Bathroom", icon: "🚻" },
};

export const AMOUNT_LABEL: Record<NonNullable<BladderEvent["amount"]>, string> = {
  drops: "Drops",
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const TRIGGER_LABEL: Record<BladderEvent["triggers"][number], string> = {
  cough: "Cough",
  sneeze: "Sneeze",
  laugh: "Laugh",
  lifting: "Lifting",
  exercise: "Exercise",
  yoga: "Yoga",
  running: "Running",
  jumping: "Jumping",
  standing_up: "Standing up",
  bending: "Bending",
  urgency: "Sudden urge",
  during_sleep: "During sleep",
  cold: "Cold weather",
  stress: "Stress",
  other: "Other",
};

/** Triggers that indicate stress (physical-pressure) incontinence. */
export const PHYSICAL_TRIGGERS = new Set(["cough", "sneeze", "laugh", "lifting", "exercise", "yoga", "running", "jumping", "standing_up", "bending"]);

export const DRINK_META: Record<FluidIntake["drink"], { label: string; icon: string; caffeinated: boolean }> = {
  water: { label: "Water", icon: "💧", caffeinated: false },
  tea: { label: "Tea", icon: "🍵", caffeinated: true },
  coffee: { label: "Coffee", icon: "☕", caffeinated: true },
  milk: { label: "Milk", icon: "🥛", caffeinated: false },
  juice: { label: "Juice", icon: "🧃", caffeinated: false },
  soda: { label: "Soda", icon: "🥤", caffeinated: true },
  alcohol: { label: "Alcohol", icon: "🍷", caffeinated: false },
  electrolyte: { label: "Electrolyte", icon: "🧂", caffeinated: false },
  other: { label: "Other", icon: "🥤", caffeinated: false },
};
