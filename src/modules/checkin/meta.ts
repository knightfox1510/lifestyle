/**
 * The check-in scales. Kept in a plain module (not the "use client" form) so
 * server pages can use the list too: values exported from a client module
 * are only references on the server, and `.map` on them crashes the page.
 */
export const SCALES = [
  { field: "sleep_quality", label: "Sleep", low: "😫", high: "😴" },
  { field: "mood", label: "Mood", low: "😞", high: "😄" },
  { field: "energy", label: "Energy", low: "🪫", high: "⚡" },
  { field: "stress", label: "Stress", low: "😌", high: "😰" },
] as const;

export type ScaleField = (typeof SCALES)[number]["field"];
