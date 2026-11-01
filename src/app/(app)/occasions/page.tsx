import { getSession } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { GiftIdea, Occasion } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { occasionInfo } from "@/modules/occasions/logic";
import { GiftForm, OccasionForm } from "./client";
import { deleteGift, deleteOccasion, setGiftStatus } from "./actions";

export const metadata = { title: "Occasions & gifts" };

const ICON = { birthday: "🎂", anniversary: "💞", festival: "🪔", other: "📅" } as const;

export default async function OccasionsPage() {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const [{ data: o }, { data: g }] = await Promise.all([
    session.supabase.from("occasions").select("*").eq("household_id", session.household.id),
    session.supabase.from("gift_ideas").select("*").eq("owner_id", session.userId).order("created_at", { ascending: false }),
  ]);
  const occasions = ((o ?? []) as Occasion[])
    .map((x) => ({ x, info: occasionInfo(x, today) }))
    .sort((a, b) => (a.info.inDays ?? 9999) - (b.info.inDays ?? 9999));
  const gifts = (g ?? []) as GiftIdea[];

  return (
    <div className="space-y-4">
      <OccasionForm />
      {occasions.length === 0 ? (
        <EmptyState title="No dates yet">Add birthdays and anniversaries. You&apos;ll get a reminder a week before.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {occasions.map(({ x, info }) => (
            <li key={x.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{ICON[x.kind]} {x.title}{info.label ? <span className="font-normal text-fg-muted"> · {info.label}</span> : null}</p>
                    <p className="text-xs text-fg-muted">{info.next ? formatDate(info.next) : "past"}{x.person ? ` · ${x.person}` : ""}{x.notes ? ` · ${x.notes}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {info.inDays !== null ? <Badge tone={info.inDays <= x.remind_days_before ? "warn" : "neutral"}>{info.inDays === 0 ? "today 🎉" : `in ${info.inDays} days`}</Badge> : null}
                    <form action={deleteOccasion.bind(null, x.id)}><button className="px-1 text-xs text-fg-muted hover:text-danger" aria-label={`Delete ${x.title}`}>✕</button></form>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="space-y-3">
        <div>
          <h2 className="font-semibold">🎁 My gift ideas</h2>
          <p className="text-xs text-fg-muted">Only you can see these, never your partner, even with sharing turned on.</p>
        </div>
        <GiftForm occasions={occasions.map(({ x }) => ({ id: x.id, title: x.title, person: x.person }))} />
        {gifts.length ? (
          <ul className="divide-y divide-border text-sm">
            {gifts.map((gi) => (
              <li key={gi.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{gi.for_person}:</strong> {gi.url ? <a href={gi.url} target="_blank" rel="noopener noreferrer" className="underline">{gi.idea}</a> : gi.idea}
                  {gi.price != null ? <span className="text-fg-muted"> · ₹{Number(gi.price).toLocaleString("en-IN")}</span> : null}
                  {gi.occasion_id ? <span className="text-fg-muted"> · {occasions.find(({ x }) => x.id === gi.occasion_id)?.x.title}</span> : null}
                </span>
                <span className="flex items-center gap-1">
                  {(["idea", "bought", "given"] as const).map((s) => (
                    <form key={s} action={setGiftStatus.bind(null, gi.id, s)}>
                      <button className={`rounded-full px-2 py-0.5 text-xs ${gi.status === s ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted"}`}>{s}</button>
                    </form>
                  ))}
                  <form action={deleteGift.bind(null, gi.id)}><button className={buttonClass("ghost", "sm")} aria-label="Delete idea">✕</button></form>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
