import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAllInOne } from "../../scripts/build-setup-sql.mjs";

describe("supabase/setup/all-in-one.sql", () => {
  it("is up to date with supabase/migrations (run: node scripts/build-setup-sql.mjs)", () => {
    expect(readFileSync(new URL("../../supabase/setup/all-in-one.sql", import.meta.url), "utf8")).toBe(buildAllInOne());
  });
});
