import { getSession } from "@/lib/session";
import { Card, EmptyState, PageHeader, Section, StatTile } from "@/components/ui";
import { CheckCircle2, Flame, Trophy } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { addDays, shortDay, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { loadDays, waterSettings } from "@/lib/today";
import { activityFor } from "@/lib/engagement";
import { dayScore } from "@/modules/engagement/rings";
import { HealthScoreCard } from "@/components/health-score";
import { formatDate } from "@/modules/medical/meta";
import { GenerateButton } from "./generate-button";

export const metadata = { title: "Weekly summary" };

export default async function DigestPage() {
  const session = await getSession();
  const t = await getT(session);
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const shown = (m: string) => session.isShown(m);
  const water = await waterSettings(session.supabase, session.userId);
  const [{ data }, days, act, { data: photoRows }] = await Promise.all([
    session.supabase.from("digests").select("week_start, content, created_at").eq("user_id", session.userId).order("week_start", { ascending: false }).limit(12),
    loadDays(session.supabase, session.userId, { tz, today, days: 14, enabled: { medicines: shown("medicines"), food: shown("food_diary"), checkin: shown("checkin"), supplements: shown("supplements") }, waterTarget: water.target, supplementTimes: session.profile.supplement_times }),
    activityFor(session, session.userId, today),
    shown("food_diary") ? session.supabase.from("food_entries").select("photo_path, eaten_at, description").eq("owner_id", session.userId).not("photo_path", "is", null).gte("eaten_at", startOfLocalDayIso(addDays(today, -6))).order("eaten_at", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
  ]);
  // The week at a glance (live): best day, days closed, streak, the week's plates.
  const week = days.statuses.slice(-7).filter((d) => d.rings.length);
  const best = week.reduce<(typeof week)[number] | null>((b, d) => (!b || dayScore(d.rings) > dayScore(b.rings) ? d : b), null);
  const closed = week.filter((d) => d.closed).length;
  const plates = [...new Map(((photoRows ?? []) as { photo_path: string; eaten_at: string; description: string }[]).map((p) => [p.photo_path, p])).values()].slice(0, 12);
  const links = plates.length ? ((await session.supabase.storage.from("food-photos").createSignedUrls(plates.map((p) => p.photo_path), 3600)).data ?? []) : [];
  const photos = plates.map((p) => ({ ...p, url: links.find((l) => l.path === p.photo_path)?.signedUrl })).filter((p) => p.url);
  const digests = (data ?? []) as { week_start: string; content: string; created_at: string }[];
  return (
    <>
      <PageHeader title="Weekly summary" subtitle="An AI recap of your week (health, habits, food, fitness) and what's coming up at home. Arrives Sunday evening if notifications are on." actions={<GenerateButton />} />
      {week.length ? (
        <Section title={t("This week at a glance")} className="mb-5">
          <HealthScoreCard statuses={days.statuses} t={t} />
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile label={t("Streak")} value={`${act.streak}`} hint={t("days")} icon={<Flame />} tint="var(--sun)" />
            <StatTile label={t("Days closed")} value={`${closed}/7`} hint={t("every goal done")} icon={<CheckCircle2 />} tint="var(--accent)" />
            <StatTile label={t("Best day")} value={best ? shortDay(best.date) : "–"} hint={best ? `${dayScore(best.rings)}%` : undefined} icon={<Trophy />} tint="var(--cat-food)" />
          </div>
          {week.some((d) => d.note) ? (
            <Card>
              <p className="mb-1.5 text-sm font-semibold">{t("Notes this week")}</p>
              <ul className="space-y-1 text-sm">
                {week.filter((d) => d.note).map((d) => (
                  <li key={d.date}><span className="text-fg-muted">{shortDay(d.date)}:</span> {d.note}</li>
                ))}
              </ul>
            </Card>
          ) : null}
          {photos.length ? (
            <Card>
              <p className="mb-2 text-sm font-semibold">{t("Your plates this week")}</p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.photo_path} src={p.url!} alt={p.description} loading="lazy" className="aspect-square w-full rounded-xl object-cover" style={{ animation: `pop .4s ${(i * 0.04).toFixed(2)}s ease-out both` }} />
                ))}
              </div>
            </Card>
          ) : null}
        </Section>
      ) : null}
      {digests.length === 0 ? (
        <EmptyState title="No summaries yet">Generate one now, or turn on notifications to get it every Sunday.</EmptyState>
      ) : (
        <div className="space-y-3">
          {digests.map((d) => (
            <Card key={d.week_start}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Week of {formatDate(d.week_start)}</p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{d.content}</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
