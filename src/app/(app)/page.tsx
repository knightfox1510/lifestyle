import Link from "next/link";
import { Flame } from "lucide-react";
import { getSession } from "@/lib/session";
import { DEFAULT_WIDGETS, WIDGET_BY_KEY } from "@/modules/widgets";
import type { UserWidget, WidgetSize } from "@/lib/types";
import { Widget } from "@/components/widgets";
import { InstallPrompt } from "@/components/install-prompt";
import { getT } from "@/lib/i18n/server";
import { localTime, todayIn } from "@/lib/dates";
import { loadDays, waterSettings } from "@/lib/today";
import { activityFor, checkMilestones, recentCheers } from "@/lib/engagement";
import { dayScore, nextUp } from "@/modules/engagement/rings";
import { DayArc, DayBars, DayTiles, WeekStrip } from "@/components/today/day-views";
import { NextUp } from "@/components/today/next-up";
import { PartnerCard } from "@/components/today/partner-card";
import { Celebrate } from "@/components/today/celebrate";

export default async function HomePage() {
  const session = await getSession();
  const t = await getT(session);
  const subject = session.subject;
  const isSelf = subject.user_id === session.userId;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const now = localTime(new Date(), tz);
  const locale = `${session.profile.language ?? "en"}-IN`;
  const can = (m: string) => session.isShown(m) && session.accessTo(m, subject.user_id) !== "none";

  const water = await waterSettings(session.supabase, subject.user_id);
  const [day, me, partner, widgetsRes] = await Promise.all([
    loadDays(session.supabase, subject.user_id, {
      tz,
      today,
      days: 30,
      enabled: { medicines: can("medicines"), food: can("food_diary"), checkin: can("checkin"), supplements: can("supplements") },
      waterTarget: water.target,
    }),
    activityFor(session, subject.user_id, today),
    isSelf && session.partner ? activityFor(session, session.partner.user_id, today) : Promise.resolve(null),
    session.supabase.from("user_widgets").select("*").eq("user_id", session.userId).order("position"),
  ]);
  const [fresh, cheers] = isSelf ? await Promise.all([checkMilestones(session, day, me.streak, today), recentCheers(session)]) : [[], []];

  const rs = day.today.rings;
  const score = dayScore(rs);
  const left = rs.filter((r) => r.pct < 1).length;
  const items = isSelf
    ? nextUp({
        now,
        dueDoses: day.dueDoses,
        dueSupplements: day.dueSupplements,
        water: { ml: day.waterMl, target: water.target, start: water.start, end: water.end },
        mealsLogged: can("food_diary") ? day.mealsToday : null,
        checkinDone: can("checkin") ? day.checkinToday : null,
      })
    : [];
  const view = session.profile.home_view ?? "arc";
  const hour = Number(now.slice(0, 2));
  const greeting = t(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

  const saved = (widgetsRes.data ?? []) as UserWidget[];
  const layout: { key: string; size: WidgetSize }[] = (saved.length ? saved.map((w) => ({ key: w.widget_key, size: w.size })) : DEFAULT_WIDGETS.map((key) => ({ key, size: WIDGET_BY_KEY[key].defaultSize }))).filter(
    (w) => w.key !== "core.today",
  );

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-fg-muted">
            {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz })}
          </p>
          <h1 className="mt-0.5 text-[28px] font-semibold leading-[1.1] tracking-[-0.035em]">
            {isSelf ? `${greeting}, ${session.me.display_name}.` : t("{person}'s day", { person: subject.display_name })}{" "}
            <span className="text-fg-muted">
              {rs.length === 0 ? "" : left === 0 ? t("Day closed.") : left === 1 ? t("1 thing left.") : t("{n} things left.", { n: left })}
            </span>
          </h1>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[14px] font-medium tabular shadow-[0_0_0_1px_var(--border)]" title={t("Day streak (one rest day a week is fine)")}>
          <Flame className="size-4 text-sun" aria-hidden />
          {me.streak}
        </span>
      </header>

      {isSelf ? <Celebrate milestones={fresh.map((m) => ({ key: m.key, title: m.title, detail: m.detail }))} closedToday={day.today.closed} date={today} /> : null}

      <section className="space-y-5 rounded-[24px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)] sm:p-5">
        {rs.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("Turn on medicines, food or check-ins to see your daily goals here.")}</p>
        ) : view === "bars" ? (
          <DayBars rings={rs} t={t} />
        ) : view === "tiles" ? (
          <DayTiles rings={rs} t={t} />
        ) : (
          <DayArc events={day.events} now={now} score={score} rings={rs} t={t} />
        )}
        <WeekStrip week={day.week} today={today} t={t} locale={locale} />
      </section>

      {isSelf ? <NextUp items={items} ownerId={session.userId} date={today} /> : null}

      {isSelf && left > 0 && Number(now.slice(0, 2)) >= 18 ? (
        <Link href="/close" className="pressable flex items-center justify-between rounded-[20px] bg-fg px-5 py-4 text-bg">
          <span className="text-[15px] font-medium">{t("Close your day")}</span>
          <span className="text-[13px] opacity-75">{t("{n} left · 30 seconds", { n: left })}</span>
        </Link>
      ) : null}

      {partner && session.partner ? (
        <PartnerCard partner={{ id: session.partner.user_id, name: session.partner.display_name, streak: partner.streak, loggedToday: partner.loggedToday }} cheers={cheers.map((c) => ({ name: c.name, emoji: c.emoji }))} />
      ) : null}

      <InstallPrompt compact />

      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{t("More on your day")}</h2>
          <Link href="/customize" className="text-[13px] text-fg-muted hover:text-fg">{t("Edit")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {layout.map((w) => (
            <Widget key={w.key} widgetKey={w.key} size={w.size} session={session} />
          ))}
        </div>
      </section>
    </div>
  );
}

