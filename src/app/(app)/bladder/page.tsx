import Link from "next/link";
import { getSession } from "@/lib/session";
import { addDays, localDate, localTime, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { Card, buttonClass } from "@/components/ui";
import type { BladderEvent, FluidIntake } from "@/lib/types";
import { dailyStats } from "@/modules/bladder/analysis";
import { loadDiaryEvents } from "@/modules/bladder/load";
import { daysBetween } from "@/modules/bladder/events";
import { getT } from "@/lib/i18n/server";
import { BladderLogForm } from "./log-form";
import { DateJump } from "@/components/date-jump";
import { AddDiaryEvent } from "./add-event";
import { deleteDiaryEvent } from "./actions";
import { BladderEventRow, FluidRow } from "./entry-row";

export const metadata = { title: "Bladder diary" };

export default async function BladderDiaryPage({ searchParams }: PageProps<"/bladder">) {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const { date: dateParam } = await searchParams;
  const date = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today ? dateParam : today;
  const canWrite = session.accessTo("bladder_diary", ownerId) === "write";
  const isOwner = ownerId === session.userId;

  const from = startOfLocalDayIso(date);
  const to = startOfLocalDayIso(addDays(date, 3));
  const t = await getT(session);
  const [{ data: ev }, { data: fl }, health] = await Promise.all([
    session.supabase.from("bladder_events").select("*").eq("owner_id", ownerId).gte("occurred_at", from).lt("occurred_at", to).order("occurred_at"),
    session.supabase.from("fluid_intake").select("*").eq("owner_id", ownerId).gte("occurred_at", from).lt("occurred_at", to).order("occurred_at"),
    loadDiaryEvents(session, ownerId, addDays(today, -183)),
  ]);
  const canAddEvent = isOwner || session.accessTo("medical_records", ownerId) === "write";
  const events = ((ev ?? []) as BladderEvent[]).filter((e) => localDate(e.occurred_at, tz) === date);
  const fluids = ((fl ?? []) as FluidIntake[]).filter((f) => localDate(f.occurred_at, tz) === date);
  const [stats] = dailyStats([date], events, fluids, tz);

  const entries = [
    ...events.map((e) => ({ type: "event" as const, at: e.occurred_at, e })),
    ...fluids.map((f) => ({ type: "fluid" as const, at: f.occurred_at, f })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-4">
      {canWrite ? <BladderLogForm key={date} ownerId={ownerId} day={date === today ? undefined : date} /> : null}

      <div className="flex items-center justify-between gap-2">
        <Link href={`/bladder?date=${addDays(date, -1)}`} className={buttonClass("ghost", "sm")}>← {shortDate(addDays(date, -1))}</Link>
        <DateJump date={date} today={today} basePath="/bladder" label={date === today ? t("Today") : shortDate(date)} />
        {date < today ? (
          <Link href={date === addDays(today, -1) ? "/bladder" : `/bladder?date=${addDays(date, 1)}`} className={buttonClass("ghost", "sm")}>
            {shortDate(addDays(date, 1))} →
          </Link>
        ) : (
          <span className="w-20" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Leaks", stats.leaks, ""],
          ["Urges", stats.urges, ""],
          ["Bathroom", stats.voids, ""],
          ["Fluids", stats.fluidMl, " ml"],
        ].map(([label, value, unit]) => (
          <Card key={label as string} className="!p-3.5">
            <p className="text-xs text-fg-muted">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {(value as number).toLocaleString("en-IN")}
              <span className="text-sm font-normal text-fg-muted">{unit}</span>
            </p>
            {label === "Fluids" && stats.caffeineMl ? <p className="text-xs text-fg-muted">{stats.caffeineMl} ml caffeinated</p> : null}
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-2 font-semibold">Entries</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-fg-muted">Nothing logged{date === today ? " yet today" : ""}.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((x) =>
              x.type === "event" ? (
                <BladderEventRow
                  key={x.e.id}
                  e={x.e}
                  ownerId={ownerId}
                  date={date}
                  time={localTime(x.at, tz)}
                  today={today}
                  canEdit={canWrite}
                  canDelete={canWrite && (isOwner || x.e.created_by === session.userId)}
                />
              ) : (
                <FluidRow
                  key={x.f.id}
                  f={x.f}
                  ownerId={ownerId}
                  date={date}
                  time={localTime(x.at, tz)}
                  today={today}
                  canEdit={canWrite}
                  canDelete={canWrite && (isOwner || x.f.created_by === session.userId)}
                />
              ),
            )}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t("Health events")}</h2>
          {canWrite ? (
            <Link href="/bladder/import" className="text-sm text-fg-muted underline hover:text-fg">
              {t("Import a WhatsApp log")}
            </Link>
          ) : null}
        </div>
        {health.length ? (
          <ul className="mb-3 divide-y divide-border">
            {health.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p>
                    <span className="mr-2 font-mono text-fg-muted">{shortDate(h.start_date)}</span>
                    <strong>{h.title}</strong>
                    <span className="text-fg-muted"> · {t("day {n}", { n: daysBetween(h.start_date, today) })}</span>
                  </p>
                  {h.details ? <p className="mt-0.5 text-fg-muted">{h.details}</p> : null}
                </div>
                {isOwner ? (
                  <form action={deleteDiaryEvent.bind(null, h.id)}>
                    <button className="text-xs text-fg-muted hover:text-danger" aria-label={t("Delete event")}>✕</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-fg-muted">{t("Add surgery, stent removal or a medicine you started to see its effect on the charts.")}</p>
        )}
        {canAddEvent ? <AddDiaryEvent ownerId={ownerId} today={today} /> : null}
      </Card>
    </div>
  );
}
