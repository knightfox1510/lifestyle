import { addDays } from "@/lib/dates";
import type { WorkoutKind, WorkoutLog } from "@/lib/types";

/** "Gym 4 times a week", "any workout 5 times": the days aren't fixed. */
export type FitnessGoal = {
  id: string;
  owner_id: string;
  kind: WorkoutKind | "any";
  times_per_week: number;
  min_minutes: number | null;
  active: boolean;
};

type Log = Pick<WorkoutLog, "performed_on" | "kind" | "status" | "duration_minutes">;

/** Monday of the week a date falls in (weeks run Monday to Sunday). */
export function weekStartOf(date: string) {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

/** The days in [from, to] with a done session that counts for the goal (one per day: two gym visits in a day are one). */
export function goalDays(goal: Pick<FitnessGoal, "kind" | "min_minutes">, logs: Log[], from: string, to: string) {
  const days = new Set<string>();
  for (const l of logs) {
    if (l.status !== "done" || l.performed_on < from || l.performed_on > to) continue;
    if (goal.kind !== "any" && l.kind !== goal.kind) continue;
    if (goal.min_minutes && (l.duration_minutes ?? 0) < goal.min_minutes) continue;
    days.add(l.performed_on);
  }
  return days;
}

export type GoalProgress = {
  done: number;
  target: number;
  /** Days left this week including today. */
  daysLeft: number;
  /** Did one today already. */
  today: boolean;
  state: "met" | "on_track" | "behind" | "tight" | "out_of_reach";
  /** Weeks in a row the goal was met, not counting this week (unless it's already met). */
  streak: number;
  /** Mon..Sun: whether each day counted. */
  week: boolean[];
};

/**
 * How a weekly goal is going. "Tight" means every remaining day is needed;
 * "on track" / "behind" compare with an even pace through the week.
 */
export function goalProgress(goal: Pick<FitnessGoal, "kind" | "min_minutes" | "times_per_week">, logs: Log[], today: string): GoalProgress {
  const start = weekStartOf(today);
  const days = goalDays(goal, logs, start, addDays(start, 6));
  const done = days.size;
  const target = goal.times_per_week;
  const dayIndex = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
  const doneToday = days.has(today);
  // Days you could still use: today only if you haven't already counted it.
  const daysLeft = 7 - dayIndex;
  const usable = daysLeft - (doneToday ? 1 : 0);
  const need = Math.max(0, target - done);
  const state: GoalProgress["state"] = need === 0
    ? "met"
    : need > usable
      ? "out_of_reach"
      : need === usable
        ? "tight"
        : done >= Math.floor((target * dayIndex) / 7)
          ? "on_track"
          : "behind";

  let streak = 0;
  for (let w = 1; w <= 52; w++) {
    const s = addDays(start, -7 * w);
    if (goalDays(goal, logs, s, addDays(s, 6)).size >= target) streak++;
    else break;
  }
  if (need === 0) streak++;
  return { done, target, daysLeft, today: doneToday, state, streak, week: Array.from({ length: 7 }, (_, i) => days.has(addDays(start, i))) };
}

export const GOAL_STATE_TEXT: Record<GoalProgress["state"], string> = {
  met: "Done for the week",
  on_track: "On track",
  behind: "Behind pace",
  tight: "Needs every day left",
  out_of_reach: "Out of reach this week",
};
