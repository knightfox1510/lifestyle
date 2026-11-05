/**
 * What counts toward a day's goals, after anything skipped on purpose
 * (pure; unit-tested). Skipped items leave the target instead of counting as
 * missed: a fasting breakfast, a rest-day supplement, a dose logged "Skipped".
 */
import type { RingInput } from "@/modules/engagement/rings";

export const skipKey = {
  dose: (medicineId: string, time: string) => `dose:${medicineId}:${time}`,
  supp: (supplementId: string) => `supp:${supplementId}`,
  meal: (meal: string) => `meal:${meal}`,
  water: "water",
  check: "check",
} as const;

export type DayGoalInput = {
  enabled: { water: boolean; food: boolean; meds: boolean; checkin: boolean };
  waterMl: number;
  waterTarget: number;
  /** Main meals logged. */
  meals: Set<string>;
  /** Scheduled dose slots; status "skipped" = skipped on purpose in Medicines. */
  slots: { medicineId: string; time: string; status: "taken" | "skipped" | null }[];
  /** Supplements due that day, and whether taken. */
  supps: { id: string; taken: boolean }[];
  checked: boolean;
  skipped: Set<string>;
};

export function dayGoalInputs(d: DayGoalInput): RingInput[] {
  const out: RingInput[] = [];
  if (d.enabled.water && !d.skipped.has(skipKey.water)) out.push({ key: "water", value: d.waterMl, target: d.waterTarget });
  if (d.enabled.food) {
    const counted = ["breakfast", "lunch", "dinner"].filter((m) => d.meals.has(m) || !d.skipped.has(skipKey.meal(m)));
    if (counted.length) out.push({ key: "food", value: counted.filter((m) => d.meals.has(m)).length, target: counted.length });
  }
  if (d.enabled.meds) {
    const slots = d.slots.filter((s) => s.status !== "skipped" && !d.skipped.has(skipKey.dose(s.medicineId, s.time)));
    const supps = d.supps.filter((s) => s.taken || !d.skipped.has(skipKey.supp(s.id)));
    const target = slots.length + supps.length;
    if (target) out.push({ key: "meds", value: slots.filter((s) => s.status === "taken").length + supps.filter((s) => s.taken).length, target });
  }
  if (d.enabled.checkin && !d.skipped.has(skipKey.check)) out.push({ key: "check", value: d.checked ? 1 : 0, target: 1 });
  return out;
}
