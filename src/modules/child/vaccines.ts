/**
 * Indian Academy of Pediatrics (IAP) immunisation schedule, simplified to
 * due ages in days. Shown as a starting point; always confirm with the
 * paediatrician (combination vaccines and catch-up plans vary).
 */
export const IAP_SCHEDULE: { vaccine: string; ageDays: number }[] = [
  { vaccine: "BCG", ageDays: 0 },
  { vaccine: "OPV 0", ageDays: 0 },
  { vaccine: "Hepatitis B 1", ageDays: 0 },
  ...["DTwP/DTaP 1", "IPV 1", "Hib 1", "Hepatitis B 2", "Rotavirus 1", "PCV 1"].map((vaccine) => ({ vaccine, ageDays: 42 })),
  ...["DTwP/DTaP 2", "IPV 2", "Hib 2", "Hepatitis B 3", "Rotavirus 2", "PCV 2"].map((vaccine) => ({ vaccine, ageDays: 70 })),
  ...["DTwP/DTaP 3", "IPV 3", "Hib 3", "Hepatitis B 4", "Rotavirus 3", "PCV 3"].map((vaccine) => ({ vaccine, ageDays: 98 })),
  { vaccine: "Influenza 1", ageDays: 183 },
  { vaccine: "Influenza 2", ageDays: 213 },
  { vaccine: "Typhoid conjugate", ageDays: 183 },
  { vaccine: "MMR 1", ageDays: 274 },
  { vaccine: "Hepatitis A 1", ageDays: 365 },
  { vaccine: "MMR 2", ageDays: 456 },
  { vaccine: "Varicella 1", ageDays: 456 },
  { vaccine: "PCV booster", ageDays: 456 },
  { vaccine: "DTwP/DTaP booster 1", ageDays: 487 },
  { vaccine: "IPV booster", ageDays: 487 },
  { vaccine: "Hib booster", ageDays: 487 },
  { vaccine: "Hepatitis A 2", ageDays: 548 },
  { vaccine: "Varicella 2", ageDays: 548 },
  { vaccine: "DTwP/DTaP booster 2", ageDays: 1461 },
  { vaccine: "IPV booster 2", ageDays: 1461 },
  { vaccine: "MMR 3", ageDays: 1461 },
  { vaccine: "HPV (2 doses, 9–14 y)", ageDays: 3287 },
  { vaccine: "Tdap", ageDays: 3652 },
];

export function ageLabel(dob: string | null, today: string) {
  if (!dob) return "";
  const days = Math.floor((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${dob}T12:00:00Z`).getTime()) / 86400_000);
  if (days < 0) return "not born yet";
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"}${months % 12 ? ` ${months % 12} mo` : ""}`;
}

export const LOG_META = {
  feed: { label: "Feed", icon: "🍼" },
  sleep: { label: "Sleep", icon: "😴" },
  diaper: { label: "Nappy", icon: "🧷" },
  medicine: { label: "Medicine", icon: "💊" },
  temperature: { label: "Temperature", icon: "🌡️" },
  milestone: { label: "Milestone", icon: "🌟" },
  note: { label: "Note", icon: "📝" },
} as const;

export function durationLabel(ms: number) {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
