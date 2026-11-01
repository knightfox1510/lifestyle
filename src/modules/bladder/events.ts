import { addDays } from "@/lib/dates";
import type { MedicalCategory } from "@/lib/types";

/** Health events shown on the bladder diary (stored as medical events). */
export const DIARY_EVENT_TYPES = ["surgery", "stent_removal", "catheter_removal", "medicine_started", "medicine_stopped", "physio_started", "other"] as const;
export type DiaryEventType = (typeof DIARY_EVENT_TYPES)[number];

export const DIARY_EVENT_META: Record<DiaryEventType, { label: string; category: MedicalCategory; needsTitle: boolean; placeholder?: string }> = {
  surgery: { label: "Surgery", category: "surgery", needsTitle: false, placeholder: "e.g. Ureter surgery" },
  stent_removal: { label: "Stent removal", category: "procedure", needsTitle: false },
  catheter_removal: { label: "Catheter removal", category: "procedure", needsTitle: false },
  medicine_started: { label: "Medicine started", category: "medication", needsTitle: true, placeholder: "Medicine name and dose" },
  medicine_stopped: { label: "Medicine stopped", category: "medication", needsTitle: true, placeholder: "Medicine name" },
  physio_started: { label: "Pelvic floor physio started", category: "procedure", needsTitle: false },
  other: { label: "Other", category: "other", needsTitle: true, placeholder: "What happened" },
};

/** The stored title. Stays in English so records read the same for everyone. */
export function diaryEventTitle(type: DiaryEventType, text: string): string {
  const t = text.trim();
  switch (type) {
    case "surgery":
      return t || "Surgery";
    case "stent_removal":
      return t ? `Stent removed: ${t}` : "Stent removed";
    case "catheter_removal":
      return t ? `Catheter removed: ${t}` : "Catheter removed";
    case "medicine_started":
      return `Started ${t}`;
    case "medicine_stopped":
      return `Stopped ${t}`;
    case "physio_started":
      return t ? `Started pelvic floor physio: ${t}` : "Started pelvic floor physio";
    default:
      return t;
  }
}

/** Medical-event categories that belong on the bladder diary timeline. */
export const DIARY_EVENT_CATEGORIES: MedicalCategory[] = ["surgery", "procedure", "medication", "hospitalization", "other"];

export type DiaryEvent = { id: string; title: string; category: MedicalCategory; start_date: string; details: string | null };

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Leaks per logged day in the `window` days before an event vs the `window`
 * days after it (the event day itself is left out). Days with nothing logged
 * don't count, so gaps in the diary don't look like dry days.
 */
export function beforeAfter(
  days: { date: string; leaks: number; logged: boolean }[],
  eventDate: string,
  window = 7,
): { before: number | null; after: number | null; beforeDays: number; afterDays: number; change: number | null } {
  const by = new Map(days.map((d) => [d.date, d]));
  const avg = (dates: string[]) => {
    const xs = dates.map((d) => by.get(d)).filter((d) => d?.logged) as { leaks: number }[];
    return { value: xs.length ? Math.round((xs.reduce((a, d) => a + d.leaks, 0) / xs.length) * 10) / 10 : null, n: xs.length };
  };
  const b = avg(Array.from({ length: window }, (_, i) => addDays(eventDate, -(i + 1))));
  const a = avg(Array.from({ length: window }, (_, i) => addDays(eventDate, i + 1)));
  const change = b.value && a.value != null ? Math.round(((a.value - b.value) / b.value) * 100) : null;
  return { before: b.value, after: a.value, beforeDays: b.n, afterDays: a.n, change };
}
