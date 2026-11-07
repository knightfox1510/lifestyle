import type { Ring, RingKey } from "./rings";
import { dayScore } from "./rings";

type Day = { date: string; rings: Ring[]; closed: boolean; note?: string | null };

const NAME: Record<RingKey, string> = { water: "Water goal", food: "Meals logged", meds: "Medicines & supplements", check: "Check-in" };
const TIP: Record<RingKey, string> = {
  water: "Keep a bottle where you work and log a glass with each meal.",
  food: "Log each meal right after eating: the + button, or say it with the mic.",
  meds: "Turn on dose reminders, and keep the strip next to your toothbrush.",
  check: "Do the 10-second check-in when you close your day.",
};
const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });

/**
 * The weekly summary without AI (pure; unit-tested): the same headings as the
 * AI version, built from the week's goals, score and what's coming up.
 */
export function plainDigest(week: Day[], lastWeek: Day[], upcoming: string[]): string {
  const scored = (ds: Day[]) => ds.filter((d) => d.rings.length).map((d) => ({ d, s: dayScore(d.rings) }));
  const tw = scored(week);
  const lw = scored(lastWeek);
  if (!tw.length) return "Not much was logged this week, so there's no summary yet.\n💡 Start with one thing: log water or close your day each evening.";
  const avg = (xs: { s: number }[]) => Math.round(xs.reduce((a, x) => a + x.s, 0) / xs.length);
  const score = avg(tw);
  const prev = lw.length ? avg(lw) : null;
  const best = [...tw].sort((a, b) => b.s - a.s)[0];
  const allDone = week.filter((d) => d.closed).length;

  // Per goal: on how many tracked days it was fully met.
  const keys = [...new Set(week.flatMap((d) => d.rings.map((r) => r.key)))] as RingKey[];
  const goal = keys.map((k) => {
    const days = week.filter((d) => d.rings.some((r) => r.key === k));
    const met = days.filter((d) => (d.rings.find((r) => r.key === k)?.pct ?? 0) >= 1).length;
    return { k, met, of: days.length, rate: days.length ? met / days.length : 0 };
  });
  const wins = goal.filter((g) => g.rate >= 0.7).sort((a, b) => b.rate - a.rate);
  const watch = goal.filter((g) => g.rate < 0.5).sort((a, b) => a.rate - b.rate);

  const lines = [
    `Score ${score}${prev != null ? `, ${score === prev ? "same as" : `${score > prev ? "up" : "down"} ${Math.abs(score - prev)} on`} last week` : ""}.`,
    `🌟 Wins: ${[
      allDone ? `every goal done on ${allDone} of ${week.length} days` : null,
      `best day ${dayName(best.d.date)} (${best.s}%)`,
      ...wins.slice(0, 2).map((g) => `${NAME[g.k]} met ${g.met} of ${g.of} days`),
    ].filter(Boolean).join("; ")}.`,
    watch.length ? `👀 Watch: ${watch.slice(0, 2).map((g) => `${NAME[g.k]} met on only ${g.met} of ${g.of} days`).join("; ")}.` : null,
    upcoming.length ? `📅 Coming up: ${upcoming.join(" ")}` : null,
    `💡 ${watch.length ? TIP[watch[0].k] : "Keep the same rhythm next week, and try closing your day every evening."}`,
  ];
  return lines.filter(Boolean).join("\n");
}
