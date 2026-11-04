import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { getSession } from "@/lib/session";
import { DEFAULT_WIDGETS, WIDGET_BY_KEY } from "@/modules/widgets";
import type { UserWidget, WidgetSize } from "@/lib/types";
import { Widget } from "@/components/widgets";
import { InstallPrompt } from "@/components/install-prompt";
import { getT } from "@/lib/i18n/server";
import { addDays, localDate, localTime, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { DateJump } from "@/components/date-jump";
import { buttonClass, cx } from "@/components/ui";
import { loadDays, waterSettings } from "@/lib/today";
import { waterAccess } from "@/lib/water";
import { WaterButtons } from "@/components/water-buttons";
import { finishWelcome } from "./welcome/actions";
import { activityFor, checkMilestones, recentCheers } from "@/lib/engagement";
import { dayScore, missedOn, nextUp } from "@/modules/engagement/rings";
import { DayArc, DayBars, DayTiles, WeekStrip } from "@/components/today/day-views";
import { NextUp } from "@/components/today/next-up";
import { PartnerCard } from "@/components/today/partner-card";
import { Celebrate } from "@/components/today/celebrate";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const session = await getSession();
  const t = await getT(session);
  const subject = session.subject;
  const isSelf = subject.user_id === session.userId;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  // ?date= shows an earlier day (up to a year back) to look at and catch up on.
  const { date: dParam } = await searchParams;
  const asked = typeof dParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dParam) ? dParam : today;
  const viewDate = asked > today ? today : asked < addDays(today, -365) ? addDays(today, -365) : asked;
  const past = viewDate < today;
  const now = past ? "23:59" : localTime(new Date(), tz);
  const locale = `${session.profile.language ?? "en"}-IN`;
  const can = (m: string) => session.isShown(m) && session.accessTo(m, subject.user_id) !== "none";

  const water = await waterSettings(session.supabase, subject.user_id);
  const waterAcc = isSelf ? "write" : waterAccess(session, subject.user_id);
  const [day, me, partner, widgetsRes] = await Promise.all([
    loadDays(session.supabase, subject.user_id, {
      tz,
      today: viewDate,
      days: 30,
      enabled: { medicines: can("medicines"), food: can("food_diary"), checkin: can("checkin"), supplements: can("supplements"), water: waterAcc !== "none" },
      waterTarget: water.target,
      supplementTimes: session.profile.supplement_times,
    }),
    activityFor(session, subject.user_id, today),
    isSelf && session.partner && !past ? activityFor(session, session.partner.user_id, today) : Promise.resolve(null),
    session.supabase.from("user_widgets").select("*").eq("user_id", session.userId).order("position"),
  ]);
  const [fresh, cheers] = isSelf && !past ? await Promise.all([checkMilestones(session, day, me.streak, today), recentCheers(session)]) : [[], []];

  // Meal photos of the day shown, as a strip under the day view.
  const { data: photoRows } = can("food_diary")
    ? await session.supabase.from("food_entries").select("photo_path, eaten_at, description").eq("owner_id", subject.user_id).not("photo_path", "is", null).gte("eaten_at", startOfLocalDayIso(viewDate)).lt("eaten_at", startOfLocalDayIso(addDays(viewDate, 2))).order("eaten_at").limit(30)
    : { data: [] };
  const dayPhotos = [...new Map(((photoRows ?? []) as { photo_path: string; eaten_at: string; description: string }[]).filter((p) => localDate(p.eaten_at, tz) === viewDate).map((p) => [p.photo_path, p])).values()].slice(0, 8);
  const photoLinks = dayPhotos.length ? ((await session.supabase.storage.from("food-photos").createSignedUrls(dayPhotos.map((p) => p.photo_path), 3600)).data ?? []) : [];
  const plates = dayPhotos.map((p) => ({ ...p, url: photoLinks.find((l) => l.path === p.photo_path)?.signedUrl ?? null })).filter((p) => p.url);

  const rs = day.today.rings;
  const score = dayScore(rs);
  const left = rs.filter((r) => r.pct < 1).length;
  const missed = {
    dueDoses: day.dueDoses,
    dueSupplements: day.dueSupplements,
    water: { ml: day.waterMl, target: water.target, start: water.start, end: water.end },
    mealsLogged: can("food_diary") ? day.mealsToday : null,
    checkinDone: can("checkin") ? day.checkinToday : null,
  };
  const items = !isSelf ? [] : past ? missedOn(missed) : nextUp({
        now,
        dueDoses: day.dueDoses,
        dueSupplements: day.dueSupplements,
        water: { ml: day.waterMl, target: water.target, start: water.start, end: water.end },
        mealsLogged: can("food_diary") ? day.mealsToday : null,
        checkinDone: can("checkin") ? day.checkinToday : null,
      });
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
          <div className="-ml-3 flex items-center gap-0.5 text-[13px] text-fg-muted">
            <Link href={`/?date=${addDays(viewDate, -1)}`} scroll={false} className="pressable grid size-8 place-items-center rounded-full hover:bg-surface-2" aria-label={t("Previous day")}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <DateJump
              date={viewDate}
              today={today}
              basePath="/"
              label={past && viewDate === addDays(today, -1) ? t("Yesterday") : new Date(`${viewDate}T12:00:00Z`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
            />
            {past ? (
              <Link href={addDays(viewDate, 1) === today ? "/" : `/?date=${addDays(viewDate, 1)}`} scroll={false} className="pressable grid size-8 place-items-center rounded-full hover:bg-surface-2" aria-label={t("Next day")}>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null}
            {past ? <Link href="/" className="ml-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-fg">{t("Back to today")}</Link> : null}
          </div>
          <h1 className="mt-0.5 text-[28px] font-semibold leading-[1.1] tracking-[-0.035em]">
            {past ? (isSelf ? t("Your day") : t("{person}'s day", { person: subject.display_name })) : isSelf ? `${greeting}, ${session.me.display_name}.` : t("{person}'s day", { person: subject.display_name })}{" "}
            <span className="text-fg-muted">
              {rs.length === 0 ? "" : left === 0 ? t("Day closed.") : past ? (left === 1 ? t("1 goal missed.") : t("{n} goals missed.", { n: left })) : left === 1 ? t("1 thing left.") : t("{n} things left.", { n: left })}
            </span>
          </h1>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[14px] font-medium tabular shadow-[0_0_0_1px_var(--border)]" title={t("Day streak (one rest day a week is fine)")}>
          <Flame className="size-4 text-sun" aria-hidden />
          {me.streak}
        </span>
      </header>

      {isSelf && !past && (session.profile as { welcome_done_at?: string | null }).welcome_done_at === null ? (
        <section className="flex flex-wrap items-center gap-3 rounded-[20px] bg-accent-soft p-4 [animation:toast-in_.3s_ease-out]">
          <span className="text-2xl" aria-hidden>👋</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("Welcome to Hearth")}</p>
            <p className="text-[13px] text-fg-muted">{t("Three quick steps: pick your features, share with {name}, put the app on your home screen.", { name: session.partner?.display_name ?? t("your partner") })}</p>
          </div>
          <div className="flex items-center gap-2">
            <form action={finishWelcome}><button className="text-[13px] text-fg-muted hover:text-fg">{t("Not now")}</button></form>
            <Link href="/welcome" className={buttonClass("primary", "sm")}>{t("Start")}</Link>
          </div>
        </section>
      ) : null}

      {isSelf && !past ? <Celebrate milestones={fresh.map((m) => ({ key: m.key, title: m.title, detail: m.detail }))} closedToday={day.today.closed} date={today} /> : null}

      <section className="space-y-5 rounded-[24px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)] sm:p-5">
        {rs.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("Turn on medicines, food or check-ins to see your daily goals here.")}</p>
        ) : view === "bars" ? (
          <DayBars rings={rs} t={t} past={past} />
        ) : view === "tiles" ? (
          <DayTiles rings={rs} t={t} past={past} />
        ) : (
          <DayArc events={day.events} now={now} score={score} rings={rs} t={t} past={past} />
        )}
        {!isSelf && waterAcc === "write" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2/60 px-3 py-2">
            <span className="text-[13px] text-fg-muted">{t("Water for {name}", { name: subject.display_name })}</span>
            <WaterButtons ownerId={subject.user_id} date={past ? viewDate : undefined} />
          </div>
        ) : null}
        {!isSelf && waterAcc === "none" ? (
          <p className="text-[12px] text-fg-muted">{t("{name} hasn't shared water with you, so it isn't shown. They can turn it on in Settings → Sharing → Water intake.", { name: subject.display_name })}</p>
        ) : null}
        {plates.length ? (
          <Link href={viewDate === today ? "/food" : `/food?date=${viewDate}`} className="block">
            <p className="mb-1.5 text-[12px] text-fg-muted">{past ? t("Plates that day") : t("Plates today")}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {plates.map((p, i) => (
                <span key={p.photo_path} className="relative shrink-0" style={{ animation: `pop .4s ${(i * 0.06).toFixed(2)}s ease-out both` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url!} alt={p.description} className="size-16 rounded-2xl object-cover shadow-[0_0_0_1px_var(--border)]" loading="lazy" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-1.5 text-[10px] font-medium text-white">{localTime(p.eaten_at, tz)}</span>
                </span>
              ))}
            </div>
          </Link>
        ) : null}
        <WeekStrip week={day.week} today={today} selected={viewDate} t={t} locale={locale} />
      </section>

      {isSelf ? <NextUp items={items} ownerId={session.userId} date={viewDate} past={past} /> : null}

      {past ? (
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{t("Add or fix that day")}</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { href: `/food?date=${viewDate}`, label: t("Food diary"), on: can("food_diary") },
              { href: `/medicines?date=${viewDate}`, label: t("Medicines"), on: can("medicines") },
              { href: "/supplements", label: t("Supplements"), on: can("supplements") },
              { href: `/checkin?date=${viewDate}`, label: t("Check-in"), on: can("checkin") },
              { href: `/bladder?date=${viewDate}`, label: t("Bladder diary"), on: can("bladder_diary") },
            ]
              .filter((x) => x.on)
              .map((x) => (
                <Link key={x.href} href={x.href} className={cx(buttonClass("secondary", "sm"))}>{x.label}</Link>
              ))}
          </div>
        </section>
      ) : null}

      {isSelf && !past && left > 0 && Number(now.slice(0, 2)) >= 18 ? (
        <Link href="/close" className="pressable flex items-center justify-between rounded-[20px] bg-fg px-5 py-4 text-bg">
          <span className="text-[15px] font-medium">{t("Close your day")}</span>
          <span className="text-[13px] opacity-75">{t("{n} left · 30 seconds", { n: left })}</span>
        </Link>
      ) : null}

      {partner && session.partner ? (
        <PartnerCard partner={{ id: session.partner.user_id, name: session.partner.display_name, streak: partner.streak, loggedToday: partner.loggedToday }} cheers={cheers.map((c) => ({ name: c.name, emoji: c.emoji }))} />
      ) : null}

      {!past ? <InstallPrompt compact /> : null}

      {!past ? <section className="space-y-2.5">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{t("More on your day")}</h2>
          <Link href="/customize" className="text-[13px] text-fg-muted hover:text-fg">{t("Edit")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {layout.map((w) => (
            <Widget key={w.key} widgetKey={w.key} size={w.size} session={session} />
          ))}
        </div>
      </section> : null}
    </div>
  );
}

