import { describe, expect, it } from "vitest";
import { drinksOf, drinksPerWeek, summarise } from "./meta";

const row = (occurred_on: string, kind: "alcohol" | "intimacy" | "smoking", detail: string | null = null, amount: number | null = null) => ({ occurred_on, kind, detail, amount });

describe("private log", () => {
  it("counts standard drinks from the serving unless an amount is given", () => {
    expect(drinksOf(row("2026-11-01", "alcohol", "large_peg"))).toBe(2);
    expect(drinksOf(row("2026-11-01", "alcohol", "wine", 3))).toBe(3);
    expect(drinksOf(row("2026-11-01", "alcohol"))).toBe(1);
    expect(drinksOf(row("2026-11-01", "intimacy", "sex"))).toBe(0);
  });

  it("summarises a week with alcohol-free days", () => {
    const logs = [row("2026-11-02", "alcohol", "beer"), row("2026-11-02", "alcohol", "beer"), row("2026-11-06", "alcohol", "spirits"), row("2026-11-03", "intimacy", "sex"), row("2026-11-03", "intimacy", "cuddle"), row("2026-11-04", "smoking", "cigarette", 3)];
    const s = summarise(logs, "2026-11-02", "2026-11-08");
    expect(s.alcoholFreeDays).toBe(5);
    expect(s.by.find((b) => b.kind === "alcohol")).toMatchObject({ entries: 3, days: 2, amount: 4 });
    expect(s.by.find((b) => b.kind === "intimacy")).toMatchObject({ entries: 2, days: 1 });
    expect(s.by.find((b) => b.kind === "smoking")?.amount).toBe(3);
  });

  it("totals drinks per week", () => {
    const w = drinksPerWeek([row("2026-10-27", "alcohol", "wine"), row("2026-11-03", "alcohol", "spirits")], "2026-11-02", 2);
    expect(w).toEqual([{ week: "2026-10-26", drinks: 1.5 }, { week: "2026-11-02", drinks: 1 }]);
  });
});
