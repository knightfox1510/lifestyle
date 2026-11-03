import Link from "next/link";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { addDays, lastNDays, localDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { loadDays, waterSettings } from "@/lib/today";
import { activityFor } from "@/lib/engagement";
import { adherence } from "@/modules/medicines/logic";
import type { Medicine, MedicineDose } from "@/lib/types";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Your week" };

/** A swipeable "your week" story built from your own data (no AI needed). */
export default async function WeeklyWrapPage() {
  const session = await getSession();
  const t = await getT(session);
  const me = session.userId;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const on = (m: string) => session.isModuleEnabled(m);
  const week = lastNDays(today, 7);
  const prevFrom = startOfLocalDayIso(addDays(today, -13));
  const water = await waterSettings(session.supabase, me);
  const [day, act, meds, doses, cheers, leaks] = await Promise.all([
    loadDays(session.supabase, me, { tz, today, days: 7, enabled: { medicines: on("medicines"), food: on("food_diary"), checkin: on("checkin"), supplements: on("supplements") }, waterTarget: water.target }),
    activityFor(session, me, today),
    on("medicines") ? session.supabase.from("medicines").select("*").eq("owner_id", me) : Promise.resolve({ data: [] }),
    on("medicines") ? session.supabase.from("medicine_doses").select("*").eq("owner_id", me).gte("scheduled_date", week[0]) : Promise.resolve({ data: [] }),
    session.supabase.from("cheers").select("emoji, created_at").eq("to_user", me).gte("created_at", startOfLocalDayIso(week[0])),
    on("bladder_diary") ? session.supabase.from("bladder_events").select("occurred_at").eq("owner_id", me).eq("kind", "leak").gte("occurred_at", prevFrom) : Promise.resolve({ data: null }),
  ]);
  const closed = day.statuses.filter((s) => s.closed).length;
  const waterAvg = Math.round(day.statuses.reduce((a, s) => a + (s.rings.find((r) => r.key === "water")?.value ?? 0), 0) / 7);
  const meals = day.statuses.reduce((a, s) => a + (s.rings.find((r) => r.key === "food")?.value ?? 0), 0);
  const adh = on("medicines") ? adherence((meds.data ?? []) as Medicine[], (doses.data ?? []) as MedicineDose[], week).pct : null;
  const leakRows = (leaks.data ?? null) as { occurred_at: string }[] | null;
  const leaksThis = leakRows?.filter((l) => localDate(l.occurred_at, tz) >= week[0]).length ?? null;
  const leaksPrev = leakRows ? leakRows.length - (leaksThis ?? 0) : null;
  const cheerList = (cheers.data ?? []) as { emoji: string }[];
  const range = `${new Date(`${week[0]}T12:00:00Z`).toLocaleDateString(`${session.profile.language ?? "en"}-IN`, { day: "numeric", month: "short", timeZone: "UTC" })} – ${new Date(`${today}T12:00:00Z`).toLocaleDateString(`${session.profile.language ?? "en"}-IN`, { day: "numeric", month: "short", timeZone: "UTC" })}`;

  const cards: { big: string; label: string; note?: string; tone: string }[] = [
    { big: `${closed} / 7`, label: t("days closed"), note: closed >= 5 ? t("A strong week.") : t("Every day counts. Aim for one more next week."), tone: "var(--accent)" },
    { big: `🔥 ${act.streak}`, label: t("day streak"), note: t("One rest day a week never breaks it."), tone: "var(--sun)" },
    ...(adh != null ? [{ big: `${adh}%`, label: t("of doses taken"), note: adh >= 90 ? t("Excellent consistency.") : t("Reminders can help with the ones you miss."), tone: "var(--cat-meds)" }] : []),
    { big: `${(waterAvg / 1000).toFixed(1)} L`, label: t("water a day on average"), note: t("Target {n} L", { n: (water.target / 1000).toFixed(1) }), tone: "var(--cat-water)" },
    ...(on("food_diary") ? [{ big: String(meals), label: t("meals logged"), tone: "var(--cat-food)" }] : []),
    ...(leaksThis != null ? [{ big: String(leaksThis), label: t("leaks this week"), note: leaksPrev != null ? (leaksThis < leaksPrev ? t("Down from {n} last week.", { n: leaksPrev }) : leaksThis > leaksPrev ? t("Up from {n} last week.", { n: leaksPrev }) : t("Same as last week.")) : undefined, tone: "var(--cat-check)" }] : []),
    ...(cheerList.length ? [{ big: cheerList.map((c) => c.emoji).slice(0, 6).join(""), label: t("cheers from your partner"), tone: "var(--danger)" }] : []),
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[13px] text-fg-muted">{range}</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.035em]">{t("Your week")}</h1>
      </header>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {cards.map((c, i) => (
          <section
            key={i}
            className="flex min-h-[260px] w-[78%] shrink-0 snap-center flex-col justify-between rounded-[28px] p-6 text-white md:w-auto"
            style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${c.tone} 92%, black), color-mix(in oklab, ${c.tone} 70%, black))` }}
          >
            <span className="text-[12px] font-medium uppercase tracking-[0.1em] opacity-80">{i + 1} / {cards.length}</span>
            <div>
              <p className="text-[52px] font-semibold leading-none tracking-[-0.04em] tabular">{c.big}</p>
              <p className="mt-2 text-[17px] font-medium">{c.label}</p>
              {c.note ? <p className="mt-1 text-[14px] opacity-85">{c.note}</p> : null}
            </div>
          </section>
        ))}
      </div>
      <p className="text-[13px] text-fg-muted md:hidden">{t("Swipe for more →")}</p>
      <Link href="/digest" className={buttonClass("secondary")}>{t("Read the AI review of your week")}</Link>
    </div>
  );
}
