import { describe, expect, it } from "vitest";
import { isCurrentOn, isUpcomingOn, slotsForDay } from "@/modules/medicines/logic";
import type { Medicine } from "@/lib/types";

const med = (extra: Partial<Medicine>): Medicine =>
  ({ id: "m1", name: "Bospi", active: true, times: ["09:00"], days_of_week: null, start_date: "2026-11-08", end_date: "2026-11-20", ...extra }) as Medicine;

describe("medicine dates", () => {
  it("a course starting later isn't due, current or listed as needed before its start", () => {
    expect(slotsForDay([med({})], [], "2026-11-02")).toEqual([]);
    expect(isCurrentOn(med({ times: [] }), "2026-11-02")).toBe(false);
    expect(isUpcomingOn(med({}), "2026-11-02")).toBe(true);
    expect(slotsForDay([med({})], [], "2026-11-08")).toHaveLength(1);
    expect(isCurrentOn(med({}), "2026-11-21")).toBe(false);
    expect(isCurrentOn(med({ active: false }), "2026-11-10")).toBe(false);
  });
});
