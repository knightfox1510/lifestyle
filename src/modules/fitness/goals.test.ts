import { describe, expect, it } from "vitest";
import { goalDays, goalProgress, weekStartOf } from "./goals";

const log = (performed_on: string, kind: "gym" | "walk" | "yoga", duration_minutes: number | null = 45, status: "done" | "skipped" = "done") => ({ performed_on, kind, status, duration_minutes });

describe("weekly fitness goals", () => {
  it("weeks start on Monday", () => {
    expect(weekStartOf("2026-11-05")).toBe("2026-11-02"); // Thursday
    expect(weekStartOf("2026-11-02")).toBe("2026-11-02");
    expect(weekStartOf("2026-11-08")).toBe("2026-11-02"); // Sunday
  });

  it("counts days, by kind, skipping skipped and short sessions", () => {
    const logs = [log("2026-11-02", "gym"), log("2026-11-02", "gym"), log("2026-11-03", "walk"), log("2026-11-04", "gym", 20), log("2026-11-05", "gym", 60, "skipped")];
    expect(goalDays({ kind: "gym", min_minutes: null }, logs, "2026-11-02", "2026-11-08").size).toBe(2);
    expect(goalDays({ kind: "gym", min_minutes: 30 }, logs, "2026-11-02", "2026-11-08").size).toBe(1);
    expect(goalDays({ kind: "any", min_minutes: null }, logs, "2026-11-02", "2026-11-08").size).toBe(3);
  });

  it("says how the week is going", () => {
    const goal = { kind: "gym" as const, min_minutes: null, times_per_week: 4 };
    // Thursday, 1 done: 3 needed with Thu–Sun (4 days) left → on pace? floor(4*3/7)=1 → on track.
    expect(goalProgress(goal, [log("2026-11-02", "gym")], "2026-11-05").state).toBe("on_track");
    // Saturday, 1 done: 3 needed, 2 days left → out of reach.
    expect(goalProgress(goal, [log("2026-11-02", "gym")], "2026-11-07").state).toBe("out_of_reach");
    // Friday, 1 done: 3 needed, 3 days left → tight.
    expect(goalProgress(goal, [log("2026-11-02", "gym")], "2026-11-06").state).toBe("tight");
    // Thursday, nothing yet out of 3: still possible but behind an even pace.
    expect(goalProgress({ ...goal, times_per_week: 3 }, [], "2026-11-05").state).toBe("behind");
    const met = goalProgress(goal, ["02", "03", "04", "05"].map((d) => log(`2026-11-${d}`, "gym")), "2026-11-05");
    expect(met.state).toBe("met");
    expect(met.week).toEqual([true, true, true, true, false, false, false]);
  });

  it("counts a streak of weeks met", () => {
    const goal = { kind: "walk" as const, min_minutes: null, times_per_week: 2 };
    const logs = [log("2026-10-19", "walk"), log("2026-10-20", "walk"), log("2026-10-26", "walk"), log("2026-10-28", "walk"), log("2026-11-02", "walk")];
    expect(goalProgress(goal, logs, "2026-11-05").streak).toBe(2);
    expect(goalProgress(goal, [...logs, log("2026-11-05", "walk")], "2026-11-05").streak).toBe(3);
  });
});
