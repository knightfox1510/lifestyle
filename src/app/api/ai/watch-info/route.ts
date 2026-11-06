import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { WATCH_KINDS, watchInfoBatchSchema, watchInfoSchema } from "@/lib/ai/watch-schemas";
import { refreshModule } from "@/lib/guards";

export const maxDuration = 120;

const body = z.union([
  z.object({ itemIds: z.array(z.uuid()).min(1).max(10) }),
  z.object({ itemId: z.uuid() }),
  z.object({ title: z.string().trim().min(1).max(150), kind: z.enum(WATCH_KINDS).optional(), year: z.number().int().optional() }),
]);

/**
 * Looks a show or movie up on the web (IMDb, JustWatch India…): year, IMDb
 * rating, genres, seasons, episode length and where it streams in India.
 * With an itemId the details are saved on that watchlist item; with a title
 * they're returned to fill in the add form.
 */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("watchlist")) throw new AiError("The watchlist is turned off.", 403);
    const input = body.parse(await request.json());
    if ("itemIds" in input) return lookUpMany(session, input.itemIds);
    let item: { id: string; title: string; kind: string; platform: string | null; total_seasons: number | null; year: number | null } | null = null;
    if ("itemId" in input) {
      const { data } = await session.supabase.from("watchlist_items").select("id, title, kind, platform, total_seasons, year").eq("id", input.itemId).eq("household_id", session.household.id).maybeSingle();
      if (!data) throw new AiError("Not found on your list.", 404);
      item = data;
    }
    const title = item?.title ?? ("title" in input ? input.title : "");
    const kind = item?.kind ?? ("kind" in input ? input.kind : undefined);
    const year = item?.year ?? ("year" in input ? input.year : undefined);

    const info = await runJson(session, {
      feature: "watch_info",
      maxDuration,
      search: true,
      quick: true,
      schema: watchInfoSchema,
      temperature: 0.1,
      // Typed in the add form: the same title looked up again within a week reuses the answer.
      cache: item ? undefined : { key: `${title.toLowerCase()}\n${kind ?? ""}\n${year ?? ""}`, days: 7 },
      parts: [
        {
          text: `Look up the ${kind && kind !== "other" ? kind : "show or movie"} "${title}"${year ? ` (${year})` : ""} for a couple in India. Search IMDb for the rating and JustWatch India / the streaming services for where it's available in India today.
- If several titles share the name, prefer the most popular one${kind ? ` that is a ${kind}` : ""}, and say so in note.
- imdb_rating: the current IMDb user rating, exactly as IMDb shows it. Never guess: null if you can't find it.
- where_to_watch: Indian streaming services only (Netflix, Prime Video, JioHotstar, SonyLIV, ZEE5, Apple TV+, MUBI…); null if it isn't streaming in India.
- For a series: number of seasons released so far and total episodes; runtime = typical episode length.
- If you can't identify it at all, set found=false.`,
        },
      ],
    });
    if (item && info.found) {
      await session.supabase
        .from("watchlist_items")
        .update({
          year: info.year,
          imdb_rating: info.imdb_rating,
          genres: info.genres.slice(0, 8),
          overview: info.overview.slice(0, 600),
          runtime_minutes: info.runtime_minutes,
          total_episodes: info.total_episodes,
          total_seasons: info.total_seasons ?? item.total_seasons,
          platform: item.platform || (info.where_to_watch ? info.where_to_watch.slice(0, 60) : null),
          info_checked_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("household_id", session.household.id);
      refreshModule("/watchlist");
    }
    return info;
  });
}

type Session = Awaited<ReturnType<typeof getSession>>;

/** "Look up all": up to 10 list items in one request, each saved like a single lookup. */
async function lookUpMany(session: Session, ids: string[]) {
  const { data } = await session.supabase.from("watchlist_items").select("id, title, kind, platform, total_seasons, year").in("id", ids).eq("household_id", session.household.id);
  const items = (data ?? []) as { id: string; title: string; kind: string; platform: string | null; total_seasons: number | null; year: number | null }[];
  if (!items.length) throw new AiError("Not found on your list.", 404);
  const res = await runJson(session, {
    feature: "watch_info",
    maxDuration,
    search: true,
    quick: true,
    schema: watchInfoBatchSchema,
    temperature: 0.1,
    parts: [
      {
        text: `Look up each of these shows/movies for a couple in India. Search IMDb for the rating and JustWatch India / the streaming services for where each is available in India today.
${items.map((i, n) => `${n + 1}. ${i.title}${i.year ? ` (${i.year})` : ""} (${i.kind})`).join("\n")}
For every number: if several titles share the name, prefer the most popular one of that type and say so in note. imdb_rating exactly as IMDb shows it, never guessed (null if not found). where_to_watch: Indian services only, null if not streaming in India. For a series: seasons released so far, total episodes, typical episode length. found=false if you can't identify it.`,
      },
    ],
  });
  const now = new Date().toISOString();
  let found = 0;
  for (const r of res.titles) {
    const item = items[r.n - 1];
    if (!item || !r.found) continue;
    found++;
    await session.supabase
      .from("watchlist_items")
      .update({
        year: r.year,
        imdb_rating: r.imdb_rating,
        genres: r.genres.slice(0, 8),
        overview: r.overview.slice(0, 600),
        runtime_minutes: r.runtime_minutes,
        total_episodes: r.total_episodes,
        total_seasons: r.total_seasons ?? item.total_seasons,
        platform: item.platform || (r.where_to_watch ? r.where_to_watch.slice(0, 60) : null),
        info_checked_at: now,
      })
      .eq("id", item.id)
      .eq("household_id", session.household.id);
  }
  // Ones it couldn't identify are marked checked too, so "Look up all" moves on to the rest.
  const missed = items.filter((i) => !res.titles.some((r) => items[r.n - 1]?.id === i.id && r.found)).map((i) => i.id);
  if (missed.length) await session.supabase.from("watchlist_items").update({ info_checked_at: now }).in("id", missed).eq("household_id", session.household.id);
  refreshModule("/watchlist");
  return { found, checked: items.length };
}
