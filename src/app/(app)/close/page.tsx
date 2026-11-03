import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { localTime, todayIn } from "@/lib/dates";
import { loadDays, waterSettings } from "@/lib/today";
import { activityFor } from "@/lib/engagement";
import type { DailyCheckin } from "@/lib/types";
import { WaterButtons } from "@/components/water-buttons";
import { QuickLogBox } from "@/components/quick-log-box";
import { DoseButtons } from "@/app/(app)/medicines/dose-buttons";
import { CheckinForm } from "@/app/(app)/checkin/checkin-form";
import { RING_META, ringValue } from "@/components/today/day-views";
import { CloseDayButton } from "./close-button";

export const metadata = { title: "Close your day" };

/** The 30-second evening review: only what's left, each with its control inline. */
export default async function CloseDayPage() {
  const session = await getSession();
  const t = await getT(session);
  const me = session.userId;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const now = localTime(new Date(), tz);
  const on = (m: string) => session.isModuleEnabled(m);
  const water = await waterSettings(session.supabase, me);
  const [day, act, ci] = await Promise.all([
    loadDays(session.supabase, me, { tz, today, days: 1, enabled: { medicines: on("medicines"), food: on("food_diary"), checkin: on("checkin"), supplements: on("supplements") }, waterTarget: water.target, supplementTimes: session.profile.supplement_times }),
    activityFor(session, me, today),
    on("checkin") ? session.supabase.from("daily_checkins").select("*").eq("owner_id", me).eq("checkin_date", today).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const left = day.today.rings.filter((r) => r.pct < 1);
  const missedDoses = day.dueDoses.filter((d) => d.time <= now);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <header>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.035em]">{t("Close your day")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{left.length ? t("{n} left. Each takes a tap.", { n: left.length }) : t("Everything's done. Just close it.")}</p>
      </header>

      {left.map((r) => (
        <section key={r.key} className="space-y-3 rounded-[22px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)]">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[16px] font-medium">
              <span className="size-2.5 rounded-full" style={{ background: RING_META[r.key].color }} />
              {t(RING_META[r.key].label)}
            </h2>
            <span className="font-mono text-[13px] text-fg-muted">{ringValue(r, t)}</span>
          </div>
          {r.key === "water" ? <WaterButtons amounts={[250, 500]} /> : null}
          {r.key === "meds" ? (
            <ul className="divide-y divide-border">
              {(missedDoses.length ? missedDoses : day.dueDoses).map((d) => (
                <li key={`${d.medicineId}-${d.time}`} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0 truncate text-[15px]">
                    <span className="mr-2 font-mono text-[13px] text-fg-muted">{d.time}</span>
                    {d.name}
                  </span>
                  <DoseButtons medicineId={d.medicineId} ownerId={me} date={today} time={d.time} doseId={null} />
                </li>
              ))}
            </ul>
          ) : null}
          {r.key === "food" ? <QuickLogBox ownerId={me} compact /> : null}
          {r.key === "check" ? <CheckinForm ownerId={me} date={today} checkin={ci.data as DailyCheckin | null} compact canWrite /> : null}
        </section>
      ))}

      <CloseDayButton allDone={left.length === 0} streak={act.streak} />
    </div>
  );
}
