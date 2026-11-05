import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { seasonCheckSchema } from "@/lib/ai/watch-schemas";
import { refreshModule } from "@/lib/guards";

export const maxDuration = 180;

/**
 * "Any new seasons?": one web search for the household's series (finished,
 * paused or being watched): how many seasons are out now and what's
 * announced next. Saved on each item; the page flags seasons nobody's seen.
 */
export async function POST() {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("watchlist")) throw new AiError("The watchlist is turned off.", 403);
    const { data } = await session.supabase
      .from("watchlist_items")
      .select("id, title, kind, year, total_seasons, status")
      .eq("household_id", session.household.id)
      .neq("kind", "movie")
      .in("status", ["watching", "paused", "finished"])
      .order("updated_at", { ascending: false })
      .limit(30);
    const shows = (data ?? []) as { id: string; title: string; kind: string; year: number | null; total_seasons: number | null }[];
    if (!shows.length) throw new AiError("No series to check yet: series you're watching, paused or finished are checked.");

    const res = await runJson(session, {
      feature: "watch_seasons",
      maxDuration,
      search: true,
      schema: seasonCheckSchema,
      temperature: 0.1,
      parts: [
        {
          text: `For each of these TV series, search the web for how many seasons have been released so far (as of today) and whether a next season is announced (with its date or month if known), or whether the show has ended.
${shows.map((s, n) => `${n + 1}. ${s.title}${s.year ? ` (${s.year})` : ""}${s.total_seasons ? `: they know of ${s.total_seasons} season${s.total_seasons === 1 ? "" : "s"}` : ""}`).join("\n")}
Answer for every number. Count a season as released once its first episode is out. Never guess: use null when you can't find it.`,
        },
      ],
    });
    const now = new Date().toISOString();
    let newOnes = 0;
    for (const r of res.shows) {
      const s = shows[r.n - 1];
      if (!s) continue;
      if (r.seasons_released && s.total_seasons && r.seasons_released > s.total_seasons) newOnes++;
      await session.supabase
        .from("watchlist_items")
        .update({ latest_season: r.seasons_released, next_season: r.next_season?.slice(0, 80) ?? null, seasons_checked_at: now })
        .eq("id", s.id)
        .eq("household_id", session.household.id);
    }
    refreshModule("/watchlist");
    return { checked: shows.length, newOnes };
  });
}
