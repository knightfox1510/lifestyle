import { describe, expect, it } from "vitest";
import { newSeason, pickForTonight, sortWatch, watchMinutes } from "./logic";

const item = (id: string, x: Partial<{ kind: "series" | "movie"; runtime_minutes: number | null; total_episodes: number | null; imdb_rating: number | null; year: number | null; updated_at: string }>) => ({
  id, kind: "movie" as "series" | "movie", runtime_minutes: null, total_episodes: null, imdb_rating: null, year: null, updated_at: "2026-11-01", ...x,
});

describe("watchlist", () => {
  it("knows how long things take", () => {
    expect(watchMinutes(item("a", { runtime_minutes: 130 }))).toBe(130);
    expect(watchMinutes(item("b", { kind: "series", runtime_minutes: 30, total_episodes: 16 }))).toBe(480);
    expect(watchMinutes(item("c", { kind: "series", runtime_minutes: 30 }))).toBeNull();
  });

  it("sorts with unknowns last", () => {
    const xs = [item("a", { imdb_rating: 7.1, runtime_minutes: 100, year: 2019 }), item("b", {}), item("c", { imdb_rating: 8.9, runtime_minutes: 150, year: 2024 })];
    expect(sortWatch(xs, "rating").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(sortWatch(xs, "short").map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(sortWatch(xs, "year").map((x) => x.id)).toEqual(["c", "a", "b"]);
  });

  it("picks something that fits tonight, preferring well-rated titles", () => {
    const xs = [item("long", { runtime_minutes: 170, imdb_rating: 9 }), item("good", { runtime_minutes: 95, imdb_rating: 8.5 }), item("meh", { runtime_minutes: 90, imdb_rating: 5.5 })];
    expect(pickForTonight(xs, 120, () => 0)?.id).toBe("good");
    const counts: Record<string, number> = {};
    for (let n = 0; n < 200; n++) {
      const p = pickForTonight(xs, 120, () => n / 200)!;
      counts[p.id] = (counts[p.id] ?? 0) + 1;
    }
    expect(counts.long).toBeUndefined();
    expect(counts.good).toBeGreaterThan(counts.meh * 5);
    expect(pickForTonight([], null)).toBeNull();
  });

  it("spots a season you haven't seen", () => {
    expect(newSeason({ kind: "series", total_seasons: 3, latest_season: 4 }, 3)).toBe(4);
    expect(newSeason({ kind: "series", total_seasons: 3, latest_season: 3 }, 2)).toBeNull();
    expect(newSeason({ kind: "series", total_seasons: null, latest_season: 2 }, null)).toBeNull();
    expect(newSeason({ kind: "movie", total_seasons: null, latest_season: 2 }, 1)).toBeNull();
  });
});
