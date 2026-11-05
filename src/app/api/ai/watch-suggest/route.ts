import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { WATCH_KINDS, watchSuggestSchema } from "@/lib/ai/watch-schemas";

export const maxDuration = 120;

const body = z.object({
  mood: z.string().trim().max(300).optional(),
  kind: z.enum(WATCH_KINDS).optional(),
  /** Minutes free tonight: favours a movie or short episodes. */
  minutes: z.number().int().min(10).max(600).nullable().optional(),
  languages: z.array(z.string().max(30)).max(6).optional(),
});

/**
 * "What should we watch?": suggestions based on what the household has
 * finished and rated, what they dropped, and tonight's mood. Skips anything
 * already on the list; checks IMDb ratings and Indian streaming with search.
 */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("watchlist")) throw new AiError("The watchlist is turned off.", 403);
    const input = body.parse(await request.json());
    const [{ data: items }, { data: progress }] = await Promise.all([
      session.supabase.from("watchlist_items").select("id, title, kind, status, genres, platform").eq("household_id", session.household.id).order("updated_at", { ascending: false }).limit(300),
      session.supabase.from("watch_progress").select("item_id, user_id, rating").eq("household_id", session.household.id).not("rating", "is", null),
    ]);
    const list = (items ?? []) as { id: string; title: string; kind: string; status: string; genres: string[] | null; platform: string | null }[];
    const ratings = (progress ?? []) as { item_id: string; user_id: string; rating: number }[];
    const name = (id: string) => (id === session.userId ? session.me.display_name : session.members.find((m) => m.user_id === id)?.display_name ?? "partner");
    const line = (i: (typeof list)[number]) => {
      const r = ratings.filter((x) => x.item_id === i.id).map((x) => `${name(x.user_id)} ${x.rating}/5`).join(", ");
      return `- ${i.title} (${i.kind}${i.genres?.length ? `; ${i.genres.join(", ")}` : ""})${r ? ` rated ${r}` : ""}`;
    };
    const by = (s: string[]) => list.filter((i) => s.includes(i.status));
    const platforms = [...new Set(list.map((i) => i.platform).filter(Boolean))].slice(0, 8);

    return runJson(session, {
      feature: "watch_suggest",
      maxDuration,
      search: true,
      schema: watchSuggestSchema,
      temperature: 0.7,
      parts: [
        {
          text: `Suggest 6 things for ${session.members.length > 1 ? `a couple (${session.members.map((m) => m.display_name).join(" and ")})` : "one person"} in India to watch next.
${input.mood ? `Tonight's mood/wish: ${input.mood}\n` : ""}${input.kind ? `Only ${input.kind === "series" ? "series" : `${input.kind}s`}.\n` : ""}${input.minutes ? `They have about ${input.minutes} minutes: favour a movie or a show with short episodes that fits.\n` : ""}${input.languages?.length ? `Languages they watch: ${input.languages.join(", ")}.\n` : ""}
Finished (ratings out of 5 tell you their taste):
${by(["finished"]).slice(0, 60).map(line).join("\n") || "- nothing yet"}
Watching now:
${by(["watching", "paused"]).slice(0, 30).map(line).join("\n") || "- nothing"}
Dropped (they didn't like these, avoid similar):
${by(["dropped"]).slice(0, 30).map(line).join("\n") || "- nothing"}
Already on their want-to-watch list (don't suggest these):
${by(["want"]).slice(0, 80).map((i) => `- ${i.title}`).join("\n") || "- nothing"}
${platforms.length ? `Services they use: ${platforms.join(", ")} (prefer these, but not only).\n` : ""}
Rules:
- Never suggest anything already listed above.
- Mix well-known and lesser-known picks; include Indian titles if their taste suggests it.
- Check each pick with search: current IMDb rating (null if not found; never guess) and where it streams in India today.
- why: one sentence linking it to something they liked, or to the mood.`,
        },
      ],
    });
  });
}
