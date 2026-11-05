/**
 * The "Us" card (pure; unit-tested): the joint weekly goal (both of you
 * closing your day) and a gentle hint about how your partner's day is going.
 */
export type MiniDay = { date: string; closed: boolean; closedAt?: string | null };

/** Days this week (Mon–today) both of you finished every goal or closed the day. */
export function jointWeek(mine: MiniDay[], theirs: MiniDay[], today: string, goal = 5) {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const days = Array.from({ length: dow + 1 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (dow - i));
    return d.toISOString().slice(0, 10);
  });
  const done = (list: MiniDay[], d: string) => list.some((x) => x.date === d && (x.closed || Boolean(x.closedAt)));
  const both = days.filter((d) => done(mine, d) && done(theirs, d)).length;
  return { both, goal, daysSoFar: days.length, reached: both >= goal };
}

/** A nudge-worthy gap in their day, kindly put; null when all's fine or it's too early/late to matter. */
export function partnerHint(p: { name: string; now: string; waterPct: number | null; lastWater: string | null; mealsLogged: number | null; dosesLeftOverdue: number }) {
  const hour = Number(p.now.slice(0, 2));
  if (hour < 10 || hour >= 22) return null;
  if (p.dosesLeftOverdue > 0) return `${p.name} has ${p.dosesLeftOverdue} dose${p.dosesLeftOverdue === 1 ? "" : "s"} still to take.`;
  if (p.waterPct != null && p.waterPct < 0.5 && hour >= 13) return p.lastWater ? `${p.name} hasn't logged water since ${p.lastWater}.` : `${p.name} hasn't logged any water yet.`;
  if (p.mealsLogged === 0 && hour >= 14) return `${p.name} hasn't logged a meal yet today.`;
  return null;
}
