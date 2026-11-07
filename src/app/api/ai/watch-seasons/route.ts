import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { seasonCheckSchema } from "@/lib/ai/watch-schemas";
import { refreshModule } from "@/lib/guards";
import { applySeasons, seasonPrompt, seasonShows } from "@/lib/watch-seasons";

export const maxDuration = 180;

/**
 * "Any new seasons?": one web search for the household's series (finished,
 * paused or being watched): how many seasons are out now and what's
 * announced next. Saved on each item; the page flags seasons nobody's seen.
 * (It also runs by itself once a month, at half price, in batch mode.)
 */
export async function POST() {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("watchlist")) throw new AiError("The watchlist is turned off.", 403);
    const shows = await seasonShows(session.supabase, session.household.id);
    if (!shows.length) throw new AiError("No series to check yet: series you're watching, paused or finished are checked.");
    const res = await runJson(session, {
      feature: "watch_seasons",
      maxDuration,
      search: true,
      schema: seasonCheckSchema,
      temperature: 0.1,
      parts: [{ text: seasonPrompt(shows) }],
    });
    const newOnes = await applySeasons(session.supabase, session.household.id, shows, res);
    refreshModule("/watchlist");
    return { checked: shows.length, newOnes };
  });
}
