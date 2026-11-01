import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, buttonClass, cx } from "@/components/ui";
import type { WatchItem, WatchProgress } from "@/lib/types";
import { AddWatchForm } from "./add-form";
import { ProgressControls, Stars } from "./progress-controls";
import { deleteWatchItem, setMyPosition, setWatchStatus } from "./actions";

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
  const { tab: t } = await searchParams;
  const tab = TABS.find((x) => x.key === t) ?? TABS[0];
  const [{ data: i }, { data: p }] = await Promise.all([
    session.supabase.from("watchlist_items").select("*").eq("household_id", session.household.id).order("updated_at", { ascending: false }),
    session.supabase.from("watch_progress").select("*").eq("household_id", session.household.id),
  ]);
  const items = (i ?? []) as WatchItem[];
  const progress = (p ?? []) as WatchProgress[];
  const shown = items.filter((x) => (tab.statuses as readonly string[]).includes(x.status));
  const names = Object.fromEntries(session.members.map((m) => [m.user_id, m.user_id === session.userId ? "You" : m.display_name]));

  return (
    <div className="space-y-4">
      <AddWatchForm />
      <div className="flex gap-1.5">
        {TABS.map((x) => (
          <Link key={x.key} href={`/watchlist?tab=${x.key}`} className={cx("rounded-full border px-3 py-1 text-sm", x.key === tab.key ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted")}>
            {x.label} ({items.filter((it) => (x.statuses as readonly string[]).includes(it.status)).length})
          </Link>
        ))}
      </div>
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
                      {it.notes ? <p className="text-xs text-fg-muted">{it.notes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
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
