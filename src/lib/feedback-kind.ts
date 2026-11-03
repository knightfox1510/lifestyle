/**
 * What kind of action a confirmation is about, so it gets a fitting
 * animation (pure; unit-tested). Most confirmations just pass a message;
 * the kind is worked out from it, and callers can name it when it's known.
 */

export const FEEDBACK_KINDS = ["food", "water", "dose", "body", "workout", "checkin", "bladder", "cart", "pantry", "habit", "ai", "delete", "undo", "save"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Colour (CSS variable) per kind, and whether it earns the big centre "stamp" (actual logging, not edits). */
export const KIND_META: Record<FeedbackKind, { color: string; stamp: boolean }> = {
  food: { color: "var(--cat-food)", stamp: true },
  water: { color: "var(--cat-water)", stamp: true },
  dose: { color: "var(--cat-meds)", stamp: true },
  body: { color: "var(--accent)", stamp: true },
  workout: { color: "var(--sun)", stamp: true },
  checkin: { color: "var(--cat-check)", stamp: true },
  bladder: { color: "var(--cat-water)", stamp: false },
  cart: { color: "var(--accent)", stamp: false },
  pantry: { color: "var(--accent)", stamp: false },
  habit: { color: "var(--cat-check)", stamp: true },
  ai: { color: "var(--accent)", stamp: false },
  delete: { color: "var(--danger)", stamp: false },
  undo: { color: "var(--fg-muted)", stamp: false },
  save: { color: "var(--accent)", stamp: false },
};

const RULES: [FeedbackKind, RegExp][] = [
  ["undo", /^undone\b|\bundone\.?$/i],
  ["delete", /\b(deleted|removed|cleared|revoked|stopped)\b/i],
  ["water", /\b(water|\d+\s?ml)\b/i],
  ["dose", /\b(dose|medicine|tablet|pill|supplement|taken)\b/i],
  ["body", /\b(weigh-?in|weight|\d+(\.\d+)?\s?kg|waist|blood pressure|bp|blood sugar|vitals?)\b/i],
  ["workout", /\b(workout|class|kegel|session|exercise|steps)\b/i],
  ["checkin", /\b(check-?in|mood|sleep)\b/i],
  ["bladder", /\b(leak|urge|toilet|void|bladder|pad)\b/i],
  ["habit", /\b(habit|streak)\b/i],
  ["cart", /\b(grocer(y|ies)|shopping list|to the list|added to list)\b/i],
  ["pantry", /\b(pantry|fridge|freezer|expir)\b/i],
  ["food", /\b(kcal|calories|logged .*(breakfast|lunch|dinner|snack)|(breakfast|lunch|dinner|snack)|meal|food|nutrition|dish|recipe|menu|plate)\b/i],
  ["ai", /\b(ai|plan ready|suggest)/i],
];

export function inferKind(message: string): FeedbackKind {
  for (const [kind, re] of RULES) if (re.test(message)) return kind;
  return "save";
}

/** A number worth floating up next to the confirmation: "+420 kcal", "+250 ml", "72.4 kg". */
export function inferDetail(message: string): string | null {
  const m = message.match(/([+−-]?\s?\d[\d,]*(\.\d+)?)\s?(kcal|ml|kg)\b/i);
  if (!m) return null;
  const n = m[1].replace(/\s/g, "");
  const unit = m[3].toLowerCase();
  return unit === "kg" || /^[+−-]/.test(n) ? `${n} ${unit}` : `+${n} ${unit}`;
}
