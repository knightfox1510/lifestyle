import { describe, expect, it } from "vitest";
import { beforeAfter, daysBetween, diaryEventTitle } from "@/modules/bladder/events";

describe("bladder diary events", () => {
  it("builds stored titles", () => {
    expect(diaryEventTitle("surgery", "")).toBe("Surgery");
    expect(diaryEventTitle("surgery", "Ureter surgery")).toBe("Ureter surgery");
    expect(diaryEventTitle("stent_removal", "")).toBe("Stent removed");
    expect(diaryEventTitle("medicine_started", " Mirabegron 25 mg ")).toBe("Started Mirabegron 25 mg");
    expect(diaryEventTitle("medicine_stopped", "Tamsulosin")).toBe("Stopped Tamsulosin");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-07", "2026-11-01")).toBe(25);
  });

  it("compares the week before and after, ignoring unlogged days and the event day", () => {
    const days = [
      { date: "2026-10-10", leaks: 10, logged: true },
      { date: "2026-10-11", leaks: 0, logged: false },
      { date: "2026-10-12", leaks: 8, logged: true },
      { date: "2026-10-13", leaks: 50, logged: true },
      { date: "2026-10-14", leaks: 4, logged: true },
      { date: "2026-10-15", leaks: 5, logged: true },
    ];
    expect(beforeAfter(days, "2026-10-13")).toEqual({ before: 9, after: 4.5, beforeDays: 2, afterDays: 2, change: -50 });
    expect(beforeAfter(days, "2026-10-01").before).toBeNull();
  });
});
