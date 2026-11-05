"use client";

import { useState, useTransition } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { Button, Card, Input, Select, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { WORKOUT_KINDS } from "@/lib/types";
import { KIND_META } from "@/modules/fitness/meta";
import { GOAL_STATE_TEXT, type GoalProgress } from "@/modules/fitness/goals";
import { deleteGoal, deleteWorkout, logGoalSession, saveGoal } from "./actions";

export type GoalRow = { id: string; kind: string; times_per_week: number; min_minutes: number | null; progress: GoalProgress };

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const kindLabel = (k: string) => (k === "any" ? "Any workout" : KIND_META[k as keyof typeof KIND_META]?.label ?? k);
const kindIcon = (k: string) => (k === "any" ? "💪" : KIND_META[k as keyof typeof KIND_META]?.icon ?? "⭐");
const TONE: Record<GoalProgress["state"], string> = { met: "text-accent", on_track: "text-fg-muted", behind: "text-fg", tight: "font-medium text-fg", out_of_reach: "text-fg-muted" };

/**
 * Weekly goals without fixed days ("gym 4×, walk 3×"): this week's ticks,
 * how it's going, the streak of weeks met, and one tap to log today.
 */
export function GoalsCard({ ownerId, today, goals, canWrite, isSelf }: { ownerId: string; today: string; goals: GoalRow[]; canWrite: boolean; isSelf: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<string>(WORKOUT_KINDS.find((k) => !goals.some((g) => g.kind === k)) ?? "any");
  const [times, setTimes] = useState(3);
  const [mins, setMins] = useState("");
  const dayIndex = 7 - (goals[0]?.progress.daysLeft ?? 7);

  if (!goals.length && !canWrite) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Weekly goals</h2>
        {canWrite && !adding ? (
          <button type="button" className="inline-flex items-center gap-1 text-sm text-accent" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add a goal
          </button>
        ) : null}
      </div>
      {!goals.length && !adding ? <p className="text-sm text-fg-muted">Any days you like: e.g. gym 4 times a week, walk 3 times. Classes you tick off and workouts you log count.</p> : null}
      <ul className="space-y-3">
        {goals.map((g) => {
          const p = g.progress;
          return (
            <li key={g.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg">{kindIcon(g.kind)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {kindLabel(g.kind)} <span className="tabular-nums text-fg-muted">· {p.done} of {p.target}{g.min_minutes ? ` (${g.min_minutes}+ min)` : ""}</span>
                  </p>
                  <p className={cx("text-xs", TONE[p.state])}>
                    {GOAL_STATE_TEXT[p.state]}
                    {p.state !== "met" && p.state !== "out_of_reach" ? ` · ${p.target - p.done} to go, ${p.daysLeft - (p.today ? 1 : 0)} day${p.daysLeft - (p.today ? 1 : 0) === 1 ? "" : "s"} left` : ""}
                    {p.streak > 1 ? <span className="ml-1.5 inline-flex items-center gap-0.5 text-sun"><Flame className="size-3" aria-hidden />{p.streak} weeks</span> : null}
                  </p>
                </div>
                {canWrite ? (
                  <Button
                    size="sm"
                    variant={p.today ? "ghost" : "secondary"}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await logGoalSession(ownerId, g.kind, today, g.min_minutes);
                        if (r.error) return toast(r.error, { tone: "error" });
                        const left = p.target - p.done - (p.today ? 0 : 1);
                        toast(`${kindLabel(g.kind)} logged`, { kind: "workout", detail: left > 0 ? `${left} to go this week` : "Weekly goal met", undo: r.id ? () => deleteWorkout(r.id!) : undefined });
                      })
                    }
                  >
                    {p.today ? "+ Again" : "Did it today"}
                  </Button>
                ) : null}
                {isSelf ? (
                  <button
                    type="button"
                    className="rounded p-1 text-fg-muted hover:text-danger"
                    aria-label={`Remove the ${kindLabel(g.kind)} goal`}
                    onClick={() => confirm(`Remove the goal “${kindLabel(g.kind)} ${g.times_per_week}× a week”? Logged workouts stay.`) && start(async () => {
                      const r = await deleteGoal(g.id);
                      toast(r.error ?? r.message ?? "Removed.", r.error ? { tone: "error" } : { kind: "delete" });
                    })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="flex gap-1" aria-label={`${p.done} of ${p.target} this week`}>
                {p.week.map((on, i) => (
                  <span key={i} className={cx("grid h-6 flex-1 place-items-center rounded-md text-[10px] font-medium", on ? "bg-accent text-accent-fg" : i === dayIndex ? "bg-surface-2 text-fg ring-1 ring-accent/50" : i < dayIndex ? "bg-surface-2/60 text-fg-muted/60" : "bg-surface-2 text-fg-muted")}>
                    {DAYS[i]}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveGoal({ ownerId, kind, times_per_week: times, min_minutes: mins });
              if (r.error) return toast(r.error, { tone: "error" });
              toast(r.message ?? "Saved.", { kind: "save" });
              setAdding(false);
              setMins("");
            });
          }}
        >
          <label className="text-xs text-fg-muted">
            What
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 block">
              <option value="any">💪 Any workout</option>
              {WORKOUT_KINDS.map((k) => (
                <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}{goals.some((g) => g.kind === k) ? " (change)" : ""}</option>
              ))}
            </Select>
          </label>
          <div className="text-xs text-fg-muted">
            Times a week
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" aria-pressed={times === n} onClick={() => setTimes(n)} className={cx("size-8 rounded-lg text-sm tabular-nums", times === n ? "bg-accent font-semibold text-accent-fg" : "bg-surface text-fg-muted")}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs text-fg-muted">
            At least (min, optional)
            <Input type="number" min={1} max={600} value={mins} onChange={(e) => setMins(e.target.value)} className="mt-1 block w-24" placeholder="30" />
          </label>
          <div className="flex gap-2">
            <Button size="sm" type="submit" pending={pending}>Save goal</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
