import { addDays } from "@/lib/dates";

/**
 * "Our week" (pure; unit-tested): the week to show and the highlight lines.
 * On Monday the week that just ended is shown; otherwise this week so far.
 */
export function recapWeek(today: string, which?: "this" | "last") {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDays(today, -dow);
  const last = which === "last" || (which !== "this" && dow === 0);
  const start = last ? addDays(monday, -7) : monday;
  const end = last ? addDays(monday, -1) : today;
  return { start, end, last, days: Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 864e5) + 1 };
}

export type PersonWeek = {
  name: string;
  /** null: not shared with the viewer. */
  workouts: { sessions: number; minutes: number; goalsMet: number; goals: number } | null;
  closedDays: number | null;
  steps: number | null;
  cheersSent: number;
};

export type RecapInput = {
  people: PersonWeek[];
  bothClosed: number | null;
  jointGoal: number;
  watched: { finished: string[]; together: { title: string; where: string }[] };
  eatingOut: number;
  last: boolean;
};

/** A few warm, factual lines, best first; nothing when there's nothing to say. */
export function recapHighlights(r: RecapInput): string[] {
  const out: string[] = [];
  const [a, b] = r.people;
  if (r.bothClosed != null && r.bothClosed > 0) out.push(r.bothClosed >= r.jointGoal ? `You both closed ${r.bothClosed} days: joint goal reached 🎉` : `You both closed ${r.bothClosed} of ${r.jointGoal} days for the joint goal.`);
  const active = r.people.filter((p) => p.workouts && p.workouts.sessions > 0);
  if (a && b && a.workouts && b.workouts && a.workouts.sessions && b.workouts.sessions) out.push(`${a.workouts.sessions + b.workouts.sessions} workouts between you (${a.name} ${a.workouts.sessions}, ${b.name} ${b.workouts.sessions}).`);
  else if (active.length === 1) out.push(`${active[0].name} worked out ${active[0].workouts!.sessions} time${active[0].workouts!.sessions === 1 ? "" : "s"}.`);
  const metAll = r.people.filter((p) => p.workouts && p.workouts.goals > 0 && p.workouts.goalsMet === p.workouts.goals);
  if (metAll.length) out.push(`${metAll.map((p) => p.name).join(" and ")} hit every weekly workout goal 💪`);
  if (r.watched.finished.length) out.push(`Finished ${r.watched.finished.slice(0, 3).join(", ")}${r.watched.finished.length > 3 ? ` and ${r.watched.finished.length - 3} more` : ""} 🎬`);
  if (r.eatingOut) out.push(`Ate out or ordered in ${r.eatingOut} time${r.eatingOut === 1 ? "" : "s"}.`);
  const cheers = r.people.reduce((s, p) => s + p.cheersSent, 0);
  if (cheers >= 3) out.push(`${cheers} cheers sent to each other.`);
  return out;
}
