import { describe, expect, it } from "vitest";
import { plainDigest } from "./plain-digest";

const r = (key: "water" | "food" | "meds" | "check", pct: number) => ({ key, value: pct, target: 1, pct });
const day = (date: string, water: number, meds: number, closed = false) => ({ date, rings: [r("water", water), r("meds", meds)], closed });

describe("plain weekly summary", () => {
  it("writes wins, things to watch and a tip from the week", () => {
    const week = ["02", "03", "04", "05", "06", "07", "08"].map((d, i) => day(`2026-11-${d}`, i < 6 ? 1 : 0.5, i < 2 ? 1 : 0.2, i < 2));
    const last = ["26", "27", "28"].map((d) => day(`2026-10-${d}`, 0.2, 0.1));
    const text = plainDigest(week, last, ["Subscriptions renewing: Netflix (2026-11-12)."]);
    expect(text).toMatch(/^Score \d+, up \d+ on last week\./);
    expect(text).toContain("every goal done on 2 of 7 days");
    expect(text).toContain("Water goal met 6 of 7 days");
    expect(text).toContain("👀 Watch: Medicines & supplements met on only 2 of 7 days");
    expect(text).toContain("📅 Coming up: Subscriptions renewing");
    expect(text).toContain("💡 Turn on dose reminders");
  });
  it("says so when there's nothing logged", () => {
    expect(plainDigest([{ date: "2026-11-02", rings: [], closed: false }], [], [])).toMatch(/^Not much was logged/);
  });
});
