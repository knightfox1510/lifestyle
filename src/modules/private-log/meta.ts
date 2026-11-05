import { addDays } from "@/lib/dates";

export const PRIVATE_KINDS = ["alcohol", "intimacy", "solo", "smoking", "cannabis", "other"] as const;
export type PrivateKind = (typeof PRIVATE_KINDS)[number];

export type PrivateLog = {
  id: string;
  owner_id: string;
  kind: PrivateKind;
  detail: string | null;
  amount: number | null;
  occurred_on: string;
  notes: string | null;
  created_at: string;
};

/**
 * What can be logged. `amount` is what the number means (standard drinks,
 * cigarettes); kinds without one are just "it happened".
 */
export const PRIVATE_META: Record<PrivateKind, { label: string; icon: string; details: { key: string; label: string; drinks?: number }[]; amount?: { unit: string; step: number; default: number } }> = {
  alcohol: {
    label: "Drinks",
    icon: "🍷",
    // A rough standard-drink count for a typical Indian serving (1 standard drink ≈ 10 g alcohol).
    details: [
      { key: "beer", label: "Beer (pint / 330 ml)", drinks: 1.5 },
      { key: "strong_beer", label: "Strong beer (500 ml)", drinks: 3 },
      { key: "wine", label: "Wine (glass)", drinks: 1.5 },
      { key: "spirits", label: "Peg (30 ml)", drinks: 1 },
      { key: "large_peg", label: "Large peg (60 ml)", drinks: 2 },
      { key: "cocktail", label: "Cocktail", drinks: 2 },
    ],
    amount: { unit: "standard drinks", step: 0.5, default: 1 },
  },
  intimacy: {
    label: "Intimacy",
    icon: "💞",
    details: [
      { key: "cuddle", label: "Cuddles" },
      { key: "kiss", label: "Kissing" },
      { key: "massage", label: "Massage" },
      { key: "sex", label: "Sex" },
    ],
  },
  solo: { label: "Solo", icon: "🫧", details: [] },
  smoking: { label: "Smoking", icon: "🚬", details: [{ key: "cigarette", label: "Cigarettes" }, { key: "vape", label: "Vape" }, { key: "hookah", label: "Hookah" }], amount: { unit: "count", step: 1, default: 1 } },
  cannabis: { label: "Cannabis", icon: "🌿", details: [] },
  other: { label: "Other", icon: "📝", details: [] },
};

export const detailLabel = (kind: PrivateKind, detail: string | null) => (detail ? PRIVATE_META[kind].details.find((d) => d.key === detail)?.label ?? detail : null);

/** Standard drinks for a logged drink: the amount if given, else the serving's usual count. */
export const drinksOf = (l: Pick<PrivateLog, "kind" | "detail" | "amount">) =>
  l.kind !== "alcohol" ? 0 : Number(l.amount ?? PRIVATE_META.alcohol.details.find((d) => d.key === l.detail)?.drinks ?? 1);

export type PrivateSummary = {
  kind: PrivateKind;
  /** Times logged in the period (days for "it happened" kinds). */
  days: number;
  entries: number;
  /** Standard drinks / cigarettes. */
  amount: number;
};

/** Totals per kind in [from, to] and alcohol-free days. */
export function summarise(logs: Pick<PrivateLog, "kind" | "detail" | "amount" | "occurred_on">[], from: string, to: string) {
  const inRange = logs.filter((l) => l.occurred_on >= from && l.occurred_on <= to);
  const by: PrivateSummary[] = PRIVATE_KINDS.map((kind) => {
    const rows = inRange.filter((l) => l.kind === kind);
    return {
      kind,
      entries: rows.length,
      days: new Set(rows.map((r) => r.occurred_on)).size,
      amount: Math.round(rows.reduce((a, r) => a + (kind === "alcohol" ? drinksOf(r) : Number(r.amount ?? 1)), 0) * 10) / 10,
    };
  }).filter((s) => s.entries > 0);
  const span = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
  const drinkDays = new Set(inRange.filter((l) => l.kind === "alcohol").map((l) => l.occurred_on)).size;
  return { by, alcoholFreeDays: span - drinkDays, span };
}

/** Drinks per week for the last n weeks (Mon–Sun), oldest first. */
export function drinksPerWeek(logs: Pick<PrivateLog, "kind" | "detail" | "amount" | "occurred_on">[], weekStart: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const s = addDays(weekStart, -7 * (n - 1 - i));
    const e = addDays(s, 6);
    return { week: s, drinks: Math.round(logs.filter((l) => l.occurred_on >= s && l.occurred_on <= e).reduce((a, l) => a + drinksOf(l), 0) * 10) / 10 };
  });
}
