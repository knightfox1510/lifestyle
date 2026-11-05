import { describe, expect, it } from "vitest";
import { recapHighlights, recapWeek } from "./recap";

describe("our week", () => {
  it("shows last week on Monday, this week otherwise", () => {
    expect(recapWeek("2026-11-09")).toMatchObject({ start: "2026-11-02", end: "2026-11-08", last: true, days: 7 });
    expect(recapWeek("2026-11-05")).toMatchObject({ start: "2026-11-02", end: "2026-11-05", last: false, days: 4 });
    expect(recapWeek("2026-11-05", "last")).toMatchObject({ start: "2026-10-26", end: "2026-11-01" });
  });

  it("writes highlights from what's there", () => {
    const lines = recapHighlights({
      people: [
        { name: "Gaurav", workouts: { sessions: 4, minutes: 200, goalsMet: 2, goals: 2 }, closedDays: 6, steps: 50000, cheersSent: 2 },
        { name: "Kari", workouts: { sessions: 3, minutes: 150, goalsMet: 0, goals: 1 }, closedDays: 5, steps: null, cheersSent: 2 },
      ],
      bothClosed: 5,
      jointGoal: 5,
      watched: { finished: ["Panchayat"], together: [] },
      eatingOut: 2,
      last: true,
    });
    expect(lines).toEqual([
      "You both closed 5 days: joint goal reached 🎉",
      "7 workouts between you (Gaurav 4, Kari 3).",
      "Gaurav hit every weekly workout goal 💪",
      "Finished Panchayat 🎬",
      "Ate out or ordered in 2 times.",
      "4 cheers sent to each other.",
    ]);
  });

  it("doesn't mention what isn't shared", () => {
    const lines = recapHighlights({ people: [{ name: "You", workouts: { sessions: 2, minutes: 60, goalsMet: 0, goals: 0 }, closedDays: 3, steps: null, cheersSent: 0 }, { name: "Kari", workouts: null, closedDays: null, steps: null, cheersSent: 0 }], bothClosed: null, jointGoal: 5, watched: { finished: [], together: [] }, eatingOut: 0, last: false });
    expect(lines).toEqual(["You worked out 2 times."]);
  });
});
