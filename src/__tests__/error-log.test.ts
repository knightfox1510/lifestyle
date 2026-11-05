import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const rows: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: async (r: Record<string, unknown>) => (rows.push(r), { error: null }) }) }) }));

describe("error log", () => {
  it("keeps the page path without its query and trims long text", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
    const { logAppError } = await import("@/lib/error-log");
    await logAppError({ source: "client", userId: "u", path: "/food?date=2026-11-04&meal=lunch#add", message: "x".repeat(900), stack: "s" });
    expect(rows[0]).toMatchObject({ source: "client", user_id: "u", path: "/food", stack: "s" });
    expect(String(rows[0].message)).toHaveLength(500);
  });
});
