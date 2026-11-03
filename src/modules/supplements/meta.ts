import type { SupplementTiming } from "@/lib/types";

export const TIMING_LABEL: Record<SupplementTiming, string> = {
  morning: "Morning",
  with_meal: "With a meal",
  afternoon: "Afternoon",
  post_workout: "Post-workout",
  evening: "Evening",
  bedtime: "Bedtime",
};

/** Rough clock time for each timing, used to place supplements in Today's schedule ("post-workout" has none: it's whenever you train). */
export const TIMING_TIME: Record<SupplementTiming, string | null> = {
  morning: "08:00",
  with_meal: "13:30",
  afternoon: "15:00",
  post_workout: null,
  evening: "19:00",
  bedtime: "22:00",
};
