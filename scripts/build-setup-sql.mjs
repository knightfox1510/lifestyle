// Concatenates supabase/migrations/*.sql into supabase/setup/all-in-one.sql so
// the whole database can be set up by pasting ONE file into the Supabase SQL
// editor (no terminal needed). Run after adding a migration:
//   node scripts/build-setup-sql.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dir = join(root, "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

export function buildAllInOne() {
  const header = `-- Hearth: complete database setup (all migrations in order).
-- Paste this whole file into Supabase → SQL Editor → New query → Run, ONCE,
-- on a new, empty project. Generated from supabase/migrations/ by
-- scripts/build-setup-sql.mjs; don't edit by hand.
`;
  return header + files.map((f) => `\n-- ============================================================\n-- ${f}\n-- ============================================================\n\n${readFileSync(join(dir, f), "utf8").trim()}\n`).join("");
}

if (process.argv[1] && process.argv[1].endsWith("build-setup-sql.mjs")) {
  writeFileSync(join(root, "supabase/setup/all-in-one.sql"), buildAllInOne());
  console.log(`wrote supabase/setup/all-in-one.sql from ${files.length} migrations`);
}
