import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

describe("meal photo clean-up", () => {
  it("removes only photos older than a day that nothing uses", async () => {
    const { cleanupFoodPhotos } = await import("@/lib/photo-cleanup");
    const now = new Date("2026-11-05T03:10:00Z");
    const removed: string[] = [];
    const files: Record<string, { id: string | null; name: string; created_at?: string }[]> = {
      "": [{ id: null, name: "u1" }],
      u1: [
        { id: "a", name: "old-used.jpg", created_at: "2026-11-01T10:00:00Z" },
        { id: "b", name: "old-orphan.jpg", created_at: "2026-11-01T10:00:00Z" },
        { id: "c", name: "new-orphan.jpg", created_at: "2026-11-05T02:00:00Z" },
        { id: "d", name: "in-template.jpg", created_at: "2026-10-01T10:00:00Z" },
      ],
    };
    const admin = {
      storage: { from: () => ({ list: async (folder: string) => ({ data: files[folder] ?? [] }), remove: async (p: string[]) => (removed.push(...p), { data: null }) }) },
      from: (table: string) => ({
        select: () =>
          table === "food_entries"
            ? { in: async () => ({ data: [{ photo_path: "u1/old-used.jpg" }] }) }
            : Promise.resolve({ data: [{ items: [{ photo_path: "u1/in-template.jpg" }] }] }),
      }),
    };
    expect(await cleanupFoodPhotos(admin as never, now)).toBe(1);
    expect(removed).toEqual(["u1/old-orphan.jpg"]);
  });
});
