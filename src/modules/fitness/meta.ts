import { dayOfWeek } from "@/lib/dates";
import type { FitnessClass, WorkoutKind, WorkoutLog } from "@/lib/types";

export const KIND_META: Record<WorkoutKind, { label: string; icon: string }> = {
  gym: { label: "Gym", icon: "🏋️" },
  yoga: { label: "Yoga", icon: "🧘" },
  pilates: { label: "Pilates", icon: "🤸" },
  swim: { label: "Swim", icon: "🏊" },
  run: { label: "Run", icon: "🏃" },
  walk: { label: "Walk", icon: "🚶" },
  cycle: { label: "Cycle", icon: "🚴" },
  dance: { label: "Dance", icon: "💃" },
  sport: { label: "Sport", icon: "🏸" },
  class: { label: "Class", icon: "📅" },
  physio: { label: "Physio", icon: "🩺" },
  other: { label: "Other", icon: "⭐" },
};

export function classesOn(classes: FitnessClass[], date: string) {
  const dow = dayOfWeek(date);
  return classes.filter((c) => c.active && c.days_of_week.includes(dow)).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/** Physical-activity days (done workouts) — used by the bladder diary comparisons. */
export function workoutDays(logs: Pick<WorkoutLog, "performed_on" | "status">[]) {
  return new Set(logs.filter((l) => l.status === "done").map((l) => l.performed_on));
}
