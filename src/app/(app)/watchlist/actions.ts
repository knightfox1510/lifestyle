"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import type { ActionResult } from "@/lib/types";

const blank = (v: unknown) => (v === "" || v == null ? null : v);
const itemSchema = z.object({
  title: z.string().trim().min(1, "Title?").max(150),
  kind: z.enum(["series", "movie", "documentary", "anime", "other"]),
  platform: z.preprocess(blank, z.string().trim().max(60).nullable()),
  status: z.enum(["want", "watching", "paused", "finished", "dropped"]).catch("want"),
  together: z.boolean(),
  total_seasons: z.preprocess(blank, z.coerce.number().int().min(1).max(100).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

export async function addWatchItem(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = itemSchema.safeParse({ ...Object.fromEntries(form), together: form.get("together") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireModule("watchlist");
    const { error } = await session.supabase.from("watchlist_items").insert({ ...parsed.data, household_id: session.household.id, added_by: session.userId });
    if (error) return { error: "Couldn't add." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/watchlist");
  return { ok: true, message: "Added." };
}

export async function setWatchStatus(id: string, status: "want" | "watching" | "paused" | "finished" | "dropped") {
  const session = await requireModule("watchlist");
  await session.supabase.from("watchlist_items").update({ status }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/watchlist");
}

/** Moves my own marker. episodeDelta adds to the current episode; newSeason starts the next season at 0. */
export async function moveProgress(itemId: string, change: { episodeDelta?: number; nextSeason?: boolean; season?: number; episode?: number }) {
  const session = await requireModule("watchlist");
  const { data: cur } = await session.supabase.from("watch_progress").select("season, episode").eq("item_id", itemId).eq("user_id", session.userId).maybeSingle();
  let season = cur?.season ?? 1;
  let episode = cur?.episode ?? 0;
  if (change.nextSeason) {
    season += 1;
    episode = 0;
  }
  if (change.episodeDelta) episode = Math.max(0, episode + change.episodeDelta);
  if (change.season !== undefined) season = Math.max(0, Math.min(100, Math.floor(change.season)));
  if (change.episode !== undefined) episode = Math.max(0, Math.min(2000, Math.floor(change.episode)));
  await session.supabase.from("watch_progress").upsert(
    { item_id: itemId, user_id: session.userId, household_id: session.household.id, season, episode, updated_at: new Date().toISOString() },
    { onConflict: "item_id,user_id" },
  );
  await session.supabase.from("watchlist_items").update({ status: "watching" }).eq("id", itemId).eq("status", "want");
  refreshModule("/watchlist");
}

export async function setMyPosition(itemId: string, form: FormData) {
  const season = Number(form.get("season"));
  const episode = Number(form.get("episode"));
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return;
  await moveProgress(itemId, { season, episode });
}

export async function rateItem(itemId: string, rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const session = await requireModule("watchlist");
  await session.supabase.from("watch_progress").upsert(
    { item_id: itemId, user_id: session.userId, household_id: session.household.id, rating, updated_at: new Date().toISOString() },
    { onConflict: "item_id,user_id" },
  );
  refreshModule("/watchlist");
}

export async function deleteWatchItem(id: string) {
  const session = await requireModule("watchlist");
  await session.supabase.from("watchlist_items").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/watchlist");
}

/** Shared: run a household-scoped update with a schema, for the inline editors. */
async function householdUpdate(module: string, table: string, id: string, values: Record<string, unknown>, path: string): Promise<ActionResult> {
  try {
    const session = await requireModule(module);
    const { data, error } = await session.supabase.from(table).update(values).eq("id", id).eq("household_id", session.household.id).select("id");
    if (error || !data?.length) return { error: "Couldn't save the changes." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule(path);
  return { ok: true, message: "Saved." };
}
const strings = (input: Record<string, unknown>) => Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v == null ? "" : v]));

export async function updateWatchItem(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = itemSchema.safeParse({ ...strings(input), together: Boolean(input.together) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return householdUpdate("watchlist", "watchlist_items", id, parsed.data, "/watchlist");
}
