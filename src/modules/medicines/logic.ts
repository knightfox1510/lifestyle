import { dayOfWeek } from "@/lib/dates";
import type { Medicine, MedicineDose } from "@/lib/types";

export function isScheduledOn(med: Medicine, date: string): boolean {
  if (!med.active || med.times.length === 0) return false;
  if (date < med.start_date) return false;
  if (med.end_date && date > med.end_date) return false;
  return !med.days_of_week || med.days_of_week.includes(dayOfWeek(date));
}

/** Active and within its start/end dates on `date` (as-needed medicines included). */
export function isCurrentOn(med: Medicine, date: string): boolean {
  return med.active && med.start_date <= date && (!med.end_date || date <= med.end_date);
}

/** Active but not started yet on `date` (e.g. a course that begins next week). */
export function isUpcomingOn(med: Medicine, date: string): boolean {
  return med.active && med.start_date > date;
}

export type DoseSlot = { medicine: Medicine; time: string; dose: MedicineDose | null };

export function slotsForDay(meds: Medicine[], doses: MedicineDose[], date: string): DoseSlot[] {
  const slots: DoseSlot[] = [];
  for (const med of meds) {
    if (!isScheduledOn(med, date)) continue;
    for (const time of [...med.times].sort()) {
      const dose =
        doses.find((d) => d.medicine_id === med.id && d.scheduled_date === date && d.scheduled_time === time) ?? null;
      slots.push({ medicine: med, time, dose });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time) || a.medicine.name.localeCompare(b.medicine.name));
}

/** Scheduled vs taken over the given days (days before today only count if fully past). */
export function adherence(meds: Medicine[], doses: MedicineDose[], days: string[]) {
  let scheduled = 0;
  let taken = 0;
  for (const date of days) {
    for (const s of slotsForDay(meds, doses, date)) {
      scheduled += 1;
      if (s.dose?.status === "taken") taken += 1;
    }
  }
  return { scheduled, taken, pct: scheduled ? Math.round((taken / scheduled) * 100) : null };
}

export function refillInfo(med: Medicine) {
  if (med.stock_count === null) return null;
  const perDay = med.dose_amount * Math.max(med.times.length, 0);
  const daysLeft = perDay > 0 ? Math.floor(med.stock_count / perDay) : null;
  const low =
    (med.refill_threshold !== null && med.stock_count <= med.refill_threshold) || (daysLeft !== null && daysLeft <= 5);
  return { stock: med.stock_count, daysLeft, low };
}

export function doseLabel(med: Medicine) {
  const amount = Number.isInteger(med.dose_amount) ? med.dose_amount : med.dose_amount.toFixed(1);
  return `${amount} ${med.dose_unit}${med.dose_amount === 1 || med.dose_unit.endsWith("s") ? "" : "s"}`;
}

export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
