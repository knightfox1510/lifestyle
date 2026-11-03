import { describe, expect, it } from "vitest";
import { inferDetail, inferKind } from "@/lib/feedback-kind";

describe("confirmation kinds", () => {
  it.each([
    ["Dal tadka added to Lunch", "food"],
    ["Logged Paneer tikka (~420 kcal).", "food"],
    ["+250 ml", "water"],
    ["Vitamin D3 taken", "dose"],
    ["Dose taken", "dose"],
    ["Weigh-in saved: 72.4 kg", "body"],
    ["Workout logged", "workout"],
    ["Check-in saved", "checkin"],
    ["Leak logged", "bladder"],
    ["Added 3 items to the grocery list", "cart"],
    ["Deleted.", "delete"],
    ["Medicine removed", "delete"],
    ["Undone", "undo"],
    ["Saved.", "save"],
    ["Targets saved to your nutrition goals.", "food"],
  ])("%s → %s", (msg, kind) => expect(inferKind(msg)).toBe(kind));

  it("pulls out a number to float up", () => {
    expect(inferDetail("Logged Paneer tikka (~420 kcal).")).toBe("+420 kcal");
    expect(inferDetail("+250 ml")).toBe("+250 ml");
    expect(inferDetail("Weigh-in saved: 72.4 kg")).toBe("72.4 kg");
    expect(inferDetail("Saved.")).toBeNull();
    expect(inferDetail("Added 1,240 kcal")).toBe("+1,240 kcal");
  });
});
