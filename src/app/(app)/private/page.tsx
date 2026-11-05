import { getSession } from "@/lib/session";
import { addDays, shortDate, shortDay, todayIn } from "@/lib/dates";
import { Card, EmptyState } from "@/components/ui";
import { ColumnChart } from "@/components/charts";
import { PRIVATE_META, detailLabel, drinksOf, drinksPerWeek, summarise, type PrivateLog } from "@/modules/private-log/meta";
import { weekStartOf } from "@/modules/fitness/goals";
import { AlcoholAiToggle, DeleteEntry, QuickLog } from "./quick-log";

export const metadata = { title: "Private log" };

function Totals({ title, s }: { title: string; s: ReturnType<typeof summarise> }) {
  const alcohol = s.by.find((b) => b.kind === "alcohol");
  return (
    <Card className="space-y-2 !p-4">
      <p className="text-sm font-semibold">{title}</p>
      {s.by.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {s.by.map((b) => (
            <li key={b.kind} className="rounded-xl bg-surface-2/60 px-3 py-2">
              <p className="text-xs text-fg-muted">{PRIVATE_META[b.kind].icon} {PRIVATE_META[b.kind].label}</p>
              <p className="text-lg font-semibold tabular-nums">
                {b.kind === "alcohol" ? `${b.amount} drinks` : b.kind === "smoking" ? `${b.amount}` : `${b.entries}×`}
              </p>
              {b.kind === "alcohol" || b.entries !== b.days ? <p className="text-xs text-fg-muted">on {b.days} day{b.days === 1 ? "" : "s"}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">Nothing logged.</p>
      )}
      {alcohol || s.span >= 7 ? <p className="text-xs text-fg-muted">{s.alcoholFreeDays} of {s.span} days alcohol-free</p> : null}
    </Card>
  );
}

export default async function PrivatePage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const isSelf = ownerId === session.userId;
  const today = todayIn(session.profile.timezone);
  const monday = weekStartOf(today);
  const { data, error } = await session.supabase
    .from("private_logs")
    .select("id, owner_id, kind, detail, amount, occurred_on, notes, created_at")
    .eq("owner_id", ownerId)
    .gte("occurred_on", addDays(monday, -77))
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    return <Card><p className="text-sm">The private log needs the latest database update: run <code>supabase/setup/update-existing-database.sql</code> in the Supabase SQL Editor.</p></Card>;
  }
  const logs = (data ?? []) as PrivateLog[];
  const week = summarise(logs, monday, today);
  const month = summarise(logs, addDays(today, -29), today);
  const drinks = drinksPerWeek(logs, monday, 12);
  const recent = logs.filter((l) => l.occurred_on >= addDays(today, -29));
  const byDay = [...new Set(recent.map((l) => l.occurred_on))];
  const aiOn = Boolean((session.profile as { ai_include_alcohol?: boolean }).ai_include_alcohol);

  return (
    <div className="space-y-4">
      {isSelf ? (
        <Card>
          <QuickLog today={today} />
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Totals title="This week" s={week} />
        <Totals title="Last 30 days" s={month} />
      </div>

      {drinks.some((w) => w.drinks > 0) ? (
        <Card>
          <ColumnChart
            title="Standard drinks per week"
            data={drinks.map((w) => ({ key: w.week, label: shortDate(w.week), value: w.drinks, tooltip: `Week of ${shortDate(w.week)}: ${w.drinks} drinks` }))}
            unit=""
            height={110}
          />
          <p className="mt-2 text-xs text-fg-muted">1 standard drink ≈ 10 g alcohol: a 30 ml peg, or about ⅔ of a 330 ml beer. Fewer drinks and more alcohol-free days help sleep, recovery and fat loss.</p>
        </Card>
      ) : null}

      {byDay.length ? (
        <Card className="space-y-3">
          <p className="text-sm font-semibold">Last 30 days</p>
          {byDay.map((d) => (
            <div key={d}>
              <p className="mb-1 text-xs text-fg-muted">{d === today ? "Today" : `${shortDay(d)} ${shortDate(d)}`}</p>
              <ul className="space-y-1">
                {recent.filter((l) => l.occurred_on === d).map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <span aria-hidden>{PRIVATE_META[l.kind].icon}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {l.kind === "other" ? l.detail : PRIVATE_META[l.kind].label}
                      {l.kind !== "other" && l.detail ? <span className="text-fg-muted"> · {detailLabel(l.kind, l.detail)}</span> : null}
                      {l.kind === "alcohol" ? <span className="text-fg-muted"> · {drinksOf(l)} drinks</span> : l.amount ? <span className="text-fg-muted"> · {Number(l.amount)}</span> : null}
                      {l.notes ? <span className="block truncate text-xs text-fg-muted">{l.notes}</span> : null}
                    </span>
                    {isSelf ? <DeleteEntry id={l.id} /> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      ) : !isSelf ? (
        <EmptyState title="Nothing logged in the last 30 days" />
      ) : null}

      {isSelf ? (
        <Card className="space-y-2 !p-4">
          <p className="text-sm font-semibold">Privacy</p>
          <p className="text-xs text-fg-muted">This log is yours alone. Your partner sees it only if you share “Private log” in Settings → Sharing, and even then can&apos;t add or change anything. It never shows on Today, in reminders or in the weekly summary. To hide it from your menus entirely, switch it off in Settings → My features.</p>
          <AlcoholAiToggle on={aiOn} />
        </Card>
      ) : null}
    </div>
  );
}
