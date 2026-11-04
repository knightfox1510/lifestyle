import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "food-photos";

/** Photo paths still used by a food entry or a saved meal. */
async function referenced(db: SupabaseClient, paths: string[]) {
  const used = new Set<string>();
  for (let i = 0; i < paths.length; i += 200) {
    const { data } = await db.from("food_entries").select("photo_path").in("photo_path", paths.slice(i, i + 200));
    for (const r of (data ?? []) as { photo_path: string }[]) used.add(r.photo_path);
  }
  const { data: tpl } = await db.from("meal_templates").select("items");
  for (const t of (tpl ?? []) as { items: { photo_path?: string | null }[] }[]) for (const i of t.items ?? []) if (i.photo_path) used.add(i.photo_path);
  return used;
}

/**
 * Removes meal photos no entry or saved meal uses any more (older than a day,
 * so a photo uploaded just before its entry is saved is never caught).
 * Runs with the service role from the nightly job.
 */
export async function cleanupFoodPhotos(admin: SupabaseClient, now = new Date()) {
  const cutoff = now.getTime() - 864e5;
  const { data: folders } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
  const old: string[] = [];
  for (const f of folders ?? []) {
    if (f.id) continue; // a file at the top level: not ours
    const { data: files } = await admin.storage.from(BUCKET).list(f.name, { limit: 1000 });
    for (const x of files ?? []) if (x.id && x.created_at && Date.parse(x.created_at) < cutoff) old.push(`${f.name}/${x.name}`);
  }
  if (!old.length) return 0;
  const used = await referenced(admin, old);
  const orphans = old.filter((p) => !used.has(p));
  for (let i = 0; i < orphans.length; i += 100) await admin.storage.from(BUCKET).remove(orphans.slice(i, i + 100));
  return orphans.length;
}

/** After deleting an entry: remove its photo too if nothing else uses it (only works for your own uploads). */
export async function removePhotoIfUnused(db: SupabaseClient, path: string | null | undefined) {
  if (!path) return;
  const used = await referenced(db, [path]);
  if (!used.has(path)) await db.storage.from(BUCKET).remove([path]);
}
