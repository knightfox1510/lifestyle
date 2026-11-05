import { z } from "zod";

export const WATCH_KINDS = ["series", "movie", "documentary", "anime", "other"] as const;

const details = {
  title: z.string().min(1).max(150).describe("The usual English title (with the original in brackets if it's commonly known by both)"),
  kind: z.enum(WATCH_KINDS),
  year: z.number().int().min(1880).max(2100).nullable().describe("Release year (first season's year for a series)"),
  imdb_rating: z.number().min(0).max(10).nullable().describe("Current IMDb rating out of 10 as shown on IMDb, one decimal; null if you couldn't find it"),
  genres: z.array(z.string().max(30)).max(6),
  overview: z.string().max(400).describe("Two sentences, no spoilers beyond the premise"),
  runtime_minutes: z.number().int().min(1).max(1000).nullable().describe("Movie: length. Series: typical episode length"),
  total_seasons: z.number().int().min(1).max(100).nullable(),
  total_episodes: z.number().int().min(1).max(5000).nullable(),
  where_to_watch: z.string().max(60).nullable().describe("Where it streams in India right now, e.g. 'Netflix', 'Prime Video', 'JioHotstar', 'SonyLIV', 'ZEE5'; several separated by ', '; null if not streaming"),
};

export const watchInfoSchema = z.object({
  found: z.boolean().describe("False if you couldn't identify the title"),
  ...details,
  language: z.string().max(30).nullable(),
  note: z.string().max(200).nullable().describe("E.g. which of several titles with the same name this is, or that a new season is coming"),
});
export type WatchInfo = z.infer<typeof watchInfoSchema>;

export const watchSuggestSchema = z.object({
  picks: z
    .array(
      z.object({
        ...details,
        language: z.string().max(30).nullable(),
        why: z.string().max(220).describe("Why it suits them, tied to what they liked or the mood asked for"),
      }),
    )
    .max(8),
  note: z.string().max(200).nullable(),
});
export type WatchSuggestion = z.infer<typeof watchSuggestSchema>["picks"][number];

export const seasonCheckSchema = z.object({
  shows: z
    .array(
      z.object({
        n: z.number().int().describe("The number of the show in the list you were given"),
        seasons_released: z.number().int().min(1).max(100).nullable().describe("Seasons fully or partly released so far (null if you can't tell)"),
        next_season: z.string().max(80).nullable().describe("What's announced next, e.g. 'Season 5: March 2027', 'Season 3 renewed, no date', 'Ended'; null if unknown"),
      }),
    )
    .max(40),
});
