import type { WatchItem } from "@/lib/types";

export const WATCH_SORTS = [
  { key: "recent", label: "Recent" },
  { key: "rating", label: "IMDb rating" },
  { key: "short", label: "Shortest" },
  { key: "year", label: "Newest" },
] as const;
export type WatchSort = (typeof WATCH_SORTS)[number]["key"];

/** Roughly how long it takes to watch: the movie, or every episode of a series (null if unknown). */
export function watchMinutes(i: Pick<WatchItem, "kind" | "runtime_minutes" | "total_episodes">) {
  if (!i.runtime_minutes) return null;
  if (i.kind === "movie") return i.runtime_minutes;
  return i.total_episodes ? i.runtime_minutes * i.total_episodes : null;
}

/** Sorts a tab's items; unknowns go last, ties keep the recent order. */
export function sortWatch<T extends Pick<WatchItem, "kind" | "runtime_minutes" | "total_episodes" | "imdb_rating" | "year" | "updated_at">>(items: T[], by: WatchSort): T[] {
  const key = (i: T): number | null => (by === "rating" ? (i.imdb_rating != null ? -Number(i.imdb_rating) : null) : by === "short" ? watchMinutes(i) : by === "year" ? (i.year ? -i.year : null) : null);
  if (by === "recent") return [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return items
    .map((i, n) => ({ i, n, k: key(i) }))
    .sort((a, b) => (a.k == null ? (b.k == null ? a.n - b.n : 1) : b.k == null ? -1 : a.k - b.k || a.n - b.n))
    .map((x) => x.i);
}

/**
 * "Pick one for us": a random pick from what fits tonight, weighted towards
 * higher IMDb ratings (an unrated title counts as 7). `minutes` keeps movies
 * that fit, and series whose episodes do.
 */
export function pickForTonight<T extends Pick<WatchItem, "id" | "kind" | "runtime_minutes" | "imdb_rating">>(items: T[], minutes: number | null, random = Math.random): T | null {
  const fits = items.filter((i) => !minutes || !i.runtime_minutes || i.runtime_minutes <= minutes);
  if (!fits.length) return null;
  const weight = (i: T) => Math.max(0.5, (Number(i.imdb_rating ?? 7) - 5) ** 2);
  const total = fits.reduce((a, i) => a + weight(i), 0);
  let r = random() * total;
  for (const i of fits) {
    r -= weight(i);
    if (r <= 0) return i;
  }
  return fits[fits.length - 1];
}

/** A season you haven't seen: the service has more seasons out than the furthest anyone in the house has watched (or the count when it was added). */
export function newSeason(i: Pick<WatchItem, "kind" | "total_seasons" | "latest_season">, watchedSeason: number | null) {
  if (i.kind === "movie" || !i.latest_season) return null;
  const seen = Math.max(watchedSeason ?? 0, i.total_seasons ?? 0);
  return seen && i.latest_season > seen ? i.latest_season : null;
}
