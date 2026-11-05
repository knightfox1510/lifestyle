import { Star } from "lucide-react";

/** "2020 · ★ 9.0 IMDb · Comedy, Drama · 30 min episodes". Works on the server and in the browser. */
export function InfoLine({ year, rating, genres, runtime, kind, episodes }: { year: number | null; rating: number | null; genres: string[] | null; runtime: number | null; kind: string; episodes?: number | null }) {
  const bits = [
    year ? String(year) : null,
    genres?.length ? genres.slice(0, 3).join(", ") : null,
    runtime ? (kind === "movie" ? `${Math.floor(runtime / 60) ? `${Math.floor(runtime / 60)} h ` : ""}${runtime % 60 ? `${runtime % 60} min` : ""}`.trim() : `${runtime} min episodes`) : null,
    episodes && kind !== "movie" ? `${episodes} episodes` : null,
  ].filter(Boolean);
  if (rating == null && !bits.length) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
      {rating != null ? (
        <span className="inline-flex items-center gap-0.5 rounded-md bg-[#f5c518] px-1.5 py-0.5 font-semibold text-black">
          <Star className="size-3 fill-current" aria-hidden /> {Number(rating).toFixed(1)} <span className="font-normal">IMDb</span>
        </span>
      ) : null}
      {bits.join(" · ")}
    </p>
  );
}
