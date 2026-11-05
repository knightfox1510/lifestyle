import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, buttonClass, cx } from "@/components/ui";
import type { WatchItem, WatchProgress } from "@/lib/types";
import { AddWatchForm } from "./add-form";
import { ProgressControls, Stars } from "./progress-controls";
import { deleteWatchItem, setMyPosition, setWatchStatus, updateWatchItem } from "./actions";
import { EditRecord } from "@/components/edit-record";
import { InfoLine } from "./info-line";
import { LookupAll, LookupButton, PickTonight, SeasonCheck, WatchSuggest } from "./watch-ai";
import { WATCH_SORTS, newSeason, sortWatch, type WatchSort } from "@/modules/watchlist/logic";

export const metadata = { title: "Watchlist" };

const TABS = [
  { key: "watching", label: "Watching", statuses: ["watching", "paused"] },
  { key: "want", label: "Want to watch", statuses: ["want"] },
  { key: "done", label: "Finished", statuses: ["finished", "dropped"] },
] as const;

const pos = (p: Pick<WatchProgress, "season" | "episode">) => p.season * 1000 + p.episode;
const label = (p: Pick<WatchProgress, "season" | "episode"> | undefined) => (p ? `S${p.season} E${p.episode}` : "not started");

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const session = await getSession();
  const { tab: t, sort: so } = await searchParams;
  const tab = TABS.find((x) => x.key === t) ?? TABS[0];
  const sort: WatchSort = WATCH_SORTS.find((x) => x.key === so)?.key ?? "recent";
  const [{ data: i }, { data: p }] = await Promise.all([
    session.supabase.from("watchlist_items").select("*").eq("household_id", session.household.id).order("updated_at", { ascending: false }),
    session.supabase.from("watch_progress").select("*").eq("household_id", session.household.id),
  ]);
  const items = (i ?? []) as WatchItem[];
  const progress = (p ?? []) as WatchProgress[];
  const shown = sortWatch(items.filter((x) => (tab.statuses as readonly string[]).includes(x.status)), sort);
  // Furthest season anyone in the house has reached, per series.
  const reached = (id: string) => progress.filter((x) => x.item_id === id).reduce<number | null>((a, x) => Math.max(a ?? 0, x.season), null);
  const series = items.filter((x) => x.kind !== "movie" && ["watching", "paused", "finished"].includes(x.status));
  const lastSeasonCheck = series.map((x) => x.seasons_checked_at).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;
  const fresh = items.filter((x) => ["paused", "finished"].includes(x.status) && newSeason(x, reached(x.id)));
  const names = Object.fromEntries(session.members.map((m) => [m.user_id, m.user_id === session.userId ? "You" : m.display_name]));

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <WatchSuggest />
        <AddWatchForm />
      </div>
      <div className="flex gap-1.5">
        {TABS.map((x) => (
          <Link key={x.key} href={`/watchlist?tab=${x.key}`} className={cx("rounded-full border px-3 py-1 text-sm", x.key === tab.key ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
            {x.label} ({items.filter((it) => (x.statuses as readonly string[]).includes(it.status)).length})
          </Link>
        ))}
      </div>
      {fresh.length ? (
        <Card className="space-y-1 !border-accent/40 !p-4">
          <p className="text-sm font-semibold">🆕 New seasons out</p>
          {fresh.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{x.title}: season {x.latest_season}{x.next_season ? <span className="text-xs text-fg-muted"> · {x.next_season}</span> : null}</span>
              <form action={setWatchStatus.bind(null, x.id, "watching")}><button className={buttonClass("secondary", "sm")}>Watch it</button></form>
            </div>
          ))}
        </Card>
      ) : null}
      {tab.key !== "done" ? <PickTonight items={items.filter((x) => (tab.key === "want" ? x.status === "want" : x.status === "want" || x.status === "watching")).map((x) => ({ id: x.id, title: x.title, kind: x.kind, runtime_minutes: x.runtime_minutes ?? null, imdb_rating: x.imdb_rating ?? null, platform: x.platform, status: x.status }))} /> : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sort">
          {WATCH_SORTS.map((x) => (
            <Link key={x.key} href={`/watchlist?tab=${tab.key}${x.key === "recent" ? "" : `&sort=${x.key}`}`} className={cx("rounded-lg px-2 py-0.5 text-xs", x.key === sort ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:text-fg")}>
              {x.label}
            </Link>
          ))}
        </div>
        {series.length ? <SeasonCheck last={lastSeasonCheck} /> : null}
      </div>
      {items.filter((x) => x.info_checked_at === null).length > 1 ? <LookupAll ids={items.filter((x) => x.info_checked_at === null && x.status !== "dropped").map((x) => x.id)} /> : null}
      {shown.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <ul className="space-y-2">
          {shown.map((it) => {
            const mine = progress.find((x) => x.item_id === it.id && x.user_id === session.userId);
            const others = session.members.filter((m) => m.user_id !== session.userId).map((m) => ({ m, p: progress.find((x) => x.item_id === it.id && x.user_id === m.user_id) }));
            const ahead = it.together && it.kind !== "movie" ? others.filter((o) => o.p && pos(o.p) !== pos(mine ?? { season: 1, episode: 0 })) : [];
            const series = it.kind !== "movie";
            return (
              <li key={it.id}>
                <Card className="space-y-2 !p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{it.title}</p>
                      <p className="text-xs text-fg-muted">
                        {it.kind}{it.platform ? ` · ${it.platform}` : ""}{it.total_seasons ? ` · ${it.total_seasons} seasons` : ""}{it.together ? " · together" : ""}
                        {it.added_by ? ` · added by ${names[it.added_by] ?? ""}` : ""}
                      </p>
                      <InfoLine year={it.year ?? null} rating={it.imdb_rating ?? null} genres={it.genres ?? null} runtime={it.runtime_minutes ?? null} kind={it.kind} episodes={it.total_episodes ?? null} />
                      {it.notes ? <p className="text-xs text-fg-muted">{it.notes}</p> : null}
                      {it.overview ? (
                        <details className="text-xs text-fg-muted">
                          <summary className="cursor-pointer">What&apos;s it about?</summary>
                          <p className="mt-1 max-w-prose">{it.overview}</p>
                        </details>
                      ) : null}
                      {it.info_checked_at === null ? <LookupButton itemId={it.id} /> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {newSeason(it, reached(it.id)) ? <Badge tone="accent">🆕 S{it.latest_season} out</Badge> : it.next_season && it.kind !== "movie" ? <Badge>{it.next_season}</Badge> : null}
                      {it.status === "paused" ? <Badge>paused</Badge> : null}
                      {it.status === "dropped" ? <Badge>dropped</Badge> : null}
                      <Stars itemId={it.id} value={mine?.rating ?? null} />
                    </div>
                  </div>

                  {series && it.status !== "want" ? (
                    <div className="space-y-1 text-sm">
                      <p>
                        <strong>You:</strong> {label(mine)}
                        {others.map((o) => (
                          <span key={o.m.user_id} className="text-fg-muted"> · {o.m.display_name}: {label(o.p)}</span>
                        ))}
                      </p>
                      {ahead.map((o) => {
                        const diff = pos(o.p!) - pos(mine ?? { season: 1, episode: 0 });
                        return (
                          <p key={o.m.user_id} className={cx("text-xs", diff > 0 ? "text-danger" : "text-fg-muted")}>
                            {diff > 0 ? `⚠️ ${o.m.display_name} is ahead of you. Don't read spoilers!` : `You're ahead of ${o.m.display_name}. Wait for them 😉`}
                          </p>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {it.status === "watching" ? <ProgressControls itemId={it.id} isSeries={series} /> : null}
                    {series && it.status === "watching" ? (
                      <details>
                        <summary className={cx(buttonClass("ghost", "sm"), "list-none")}>Set S/E</summary>
                        <form action={setMyPosition.bind(null, it.id)} className="mt-1 flex items-center gap-1">
                          <input name="season" type="number" min={0} max={100} defaultValue={mine?.season ?? 1} className="h-8 w-14 rounded-lg border border-border bg-surface px-2 text-sm" aria-label="Season" />
                          <input name="episode" type="number" min={0} max={2000} defaultValue={mine?.episode ?? 0} className="h-8 w-16 rounded-lg border border-border bg-surface px-2 text-sm" aria-label="Episode" />
                          <button className={buttonClass("secondary", "sm")}>Save</button>
                        </form>
                      </details>
                    ) : null}
                    {it.status === "want" ? (
                      <form action={setWatchStatus.bind(null, it.id, "watching")}><button className={buttonClass("primary", "sm")}>Start watching</button></form>
                    ) : null}
                    {it.status === "watching" ? (
                      <>
                        <form action={setWatchStatus.bind(null, it.id, "finished")}><button className={buttonClass("ghost", "sm")}>Finished</button></form>
                        <form action={setWatchStatus.bind(null, it.id, "paused")}><button className={buttonClass("ghost", "sm")}>Pause</button></form>
                      </>
                    ) : null}
                    {it.status === "paused" || it.status === "finished" || it.status === "dropped" ? (
                      <form action={setWatchStatus.bind(null, it.id, "watching")}><button className={buttonClass("ghost", "sm")}>Resume</button></form>
                    ) : null}
                    {it.status !== "dropped" && it.status !== "finished" ? (
                      <form action={setWatchStatus.bind(null, it.id, "dropped")}><button className={buttonClass("ghost", "sm")}>Drop</button></form>
                    ) : null}
                    <EditRecord
                      fields={[
                        { name: "title", label: "Title", type: "text", maxLength: 150 },
                        { name: "kind", label: "Kind", type: "select", options: ["series", "movie", "documentary", "anime", "other"].map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })) },
                        { name: "platform", label: "Where", type: "text", maxLength: 60 },
                        { name: "status", label: "Status", type: "select", options: ["want", "watching", "paused", "finished", "dropped"].map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })) },
                        { name: "total_seasons", label: "Seasons", type: "number", min: 1, max: 100, step: 1 },
                        { name: "together", label: "Watching together", type: "checkbox" },
                        { name: "notes", label: "Notes", type: "textarea", maxLength: 500 },
                      ]}
                      values={{ title: it.title, kind: it.kind, platform: it.platform, status: it.status, total_seasons: it.total_seasons, together: it.together, notes: it.notes }}
                      onSave={updateWatchItem.bind(null, it.id)}
                    />
                    <form action={deleteWatchItem.bind(null, it.id)}>
                      <button className="px-1 text-xs text-fg-muted hover:text-danger" aria-label={`Delete ${it.title}`}>✕</button>
                    </form>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
