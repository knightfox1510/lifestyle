import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAllInOne } from "../../scripts/build-setup-sql.mjs";

describe("supabase/setup/all-in-one.sql", () => {
  it("is up to date with supabase/migrations (run: node scripts/build-setup-sql.mjs)", () => {
    expect(readFileSync(new URL("../../supabase/setup/all-in-one.sql", import.meta.url), "utf8")).toBe(buildAllInOne());
  });
});

describe("supabase/setup/update-existing-database.sql", () => {
  const update = readFileSync(new URL("../../supabase/setup/update-existing-database.sql", import.meta.url), "utf8");
  it("covers everything added after the language migration", () => {
    for (const thing of ["home_view", "close_day", "close_day_time", "partner_updates", "public.cheers", "public.milestones", "public.activity_days", "ai_model", "'other'", "public.accept_invite", "nutrients_source", "running_low", "pantry_item_id"]) {
      expect(update, thing).toContain(thing);
    }
  });
  it("only uses re-runnable statements", () => {
    expect(update).not.toMatch(/add column (?!if not exists)/i);
    expect(update).not.toMatch(/create table (?!if not exists)/i);
    // Every policy is dropped first so re-running doesn't fail on "already exists".
    expect((update.match(/create policy/gi) ?? []).length).toBe((update.match(/drop policy if exists/gi) ?? []).length);
  });
});
