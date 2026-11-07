import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { seasonCheckSchema } from "@/lib/ai/watch-schemas";

export type SeasonShow = { id: string; title: string; kind: string; year: number | null; total_seasons: number | null };

/** The household's series worth checking: being watched, paused or finished. */
export async function seasonShows(db: SupabaseClient, householdId: string): Promise<SeasonShow[]> {
  const { data } = await db
    .from("watchlist_items")
    .select("id, title, kind, year, total_seasons, status")
    .eq("household_id", householdId)
    .neq("kind", "movie")
    .in("status", ["watching", "paused", "finished"])
    .order("updated_at", { ascending: false })
    .limit(30);
  return (data ?? []) as SeasonShow[];
}

export function seasonPrompt(shows: SeasonShow[]) {
  return `For each of these TV series, search the web for how many seasons have been released so far (as of today) and whether a next season is announced (with its date or month if known), or whether the show has ended.
${shows.map((s, n) => `${n + 1}. ${s.title}${s.year ? ` (${s.year})` : ""}${s.total_seasons ? `: they know of ${s.total_seasons} season${s.total_seasons === 1 ? "" : "s"}` : ""}`).join("\n")}
Answer for every number. Count a season as released once its first episode is out. Never guess: use null when you can't find it.`;
}

/** Saves the answer on each show; returns how many have a season beyond what the household knew of. */
export async function applySeasons(db: SupabaseClient, householdId: string, shows: SeasonShow[], res: z.infer<typeof seasonCheckSchema>) {
  const now = new Date().toISOString();
  let newOnes = 0;
  for (const r of res.shows) {
    const s = shows[r.n - 1];
    if (!s) continue;
    if (r.seasons_released && s.total_seasons && r.seasons_released > s.total_seasons) newOnes++;
    await db
      .from("watchlist_items")
      .update({ latest_season: r.seasons_released, next_season: r.next_season?.slice(0, 80) ?? null, seasons_checked_at: now })
      .eq("id", s.id)
      .eq("household_id", householdId);
  }
  return newOnes;
}
