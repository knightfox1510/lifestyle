import Link from "next/link";
import { getSession } from "@/lib/session";
import { addDays, localTime, shortDate, todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, Notice, buttonClass } from "@/components/ui";
import { DateJump } from "@/components/date-jump";
import type { Medicine, MedicineDose } from "@/lib/types";
import { doseLabel, refillInfo, slotsForDay } from "@/modules/medicines/logic";
import { DoseButtons, AsNeededButton } from "./dose-buttons";
import { getT } from "@/lib/i18n/server";
import { medicineChecksFor } from "@/lib/medicine-checks";

export const metadata = { title: "Medicines" };

export default async function MedicinesTodayPage({ searchParams }: PageProps<"/medicines">) {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const { date: dParam } = await searchParams;
  // Any earlier day can be filled in too (e.g. yesterday, when you've just started).
  const date = typeof dParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dParam) && dParam < today ? dParam : today;
  const isToday = date === today;
  const canWrite = session.accessTo("medicines", ownerId) === "write";
  const t = await getT(session);

  const [{ data: medData }, { data: doseData }] = await Promise.all([
    session.supabase.from("medicines").select("*").eq("owner_id", ownerId).eq("active", true).order("name"),
    session.supabase.from("medicine_doses").select("*").eq("owner_id", ownerId).eq("scheduled_date", date),
  ]);
  const meds = (medData ?? []) as Medicine[];
  const doses = (doseData ?? []) as MedicineDose[];
  // On an earlier day, also show medicines added later (you may have been taking them already).
  const startedLater = new Set(isToday ? [] : meds.filter((m) => m.start_date > date).map((m) => m.id));
  const slots = slotsForDay(isToday ? meds : meds.map((m) => (startedLater.has(m.id) ? { ...m, start_date: date } : m)), doses, date);
  const asNeeded = meds.filter((m) => m.times.length === 0);
  const lowStock = meds.map((m) => ({ m, r: refillInfo(m) })).filter((x) => x.r?.low);
  const now = localTime(new Date(), tz);
  const done = slots.filter((s) => s.dose).length;
  const serious = meds.length ? (await medicineChecksFor(session, ownerId)).findings.filter((f) => f.severity === "high") : [];

  if (meds.length === 0) {
    return (
      <EmptyState title={t("No medicines yet")}>
        <Link href="/medicines/manage" className="text-accent underline">{t("Add a prescription or course")}</Link> {t("to get a daily schedule.")}
      </EmptyState>
    );
  }

  const dayNav = (
    <div className="flex items-center justify-between gap-2">
      <Link href={`/medicines?date=${addDays(date, -1)}`} className={buttonClass("ghost", "sm")}>← {shortDate(addDays(date, -1))}</Link>
      <DateJump date={date} today={today} basePath="/medicines" label={isToday ? t("Today") : shortDate(date)} />
      {!isToday ? (
        <Link href={date === addDays(today, -1) ? "/medicines" : `/medicines?date=${addDays(date, 1)}`} className={buttonClass("ghost", "sm")}>{shortDate(addDays(date, 1))} →</Link>
      ) : (
        <span className="w-20" />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {dayNav}
      {!isToday ? <Notice tone="accent">{t("Logging doses for {date}. They're saved at their scheduled time.", { date: shortDate(date) })}</Notice> : null}
      {serious.length ? (
        <Notice tone="danger">
          ⚠️ {t("{n} medicine safety check(s) to discuss with your doctor:", { n: serious.length })} {serious.map((f) => f.title).join("; ")}.{" "}
          <Link href="/medicines/checks" className="font-medium underline">{t("See checks")}</Link>
        </Notice>
      ) : null}
      {lowStock.length ? (
        <Notice tone="danger">
          ⚠️ {t("Running low:")}{" "}
          {lowStock.map(({ m, r }, i) => (
            <span key={m.id}>
              {i ? ", " : ""}
              <strong>{m.name}</strong> ({r!.stock} left{r!.daysLeft !== null ? `, ~${r!.daysLeft} days` : ""})
            </span>
          ))}
          . {t("Restock from the Medicines tab.")}
        </Notice>
      ) : null}

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">{isToday ? t("Today's doses") : t("Doses on {date}", { date: shortDate(date) })}</h2>
          <span className="text-sm text-fg-muted">
            {t("{done}/{total} done", { done, total: slots.length })}
          </span>
        </div>
        {slots.length === 0 ? (
          <p className="text-sm text-fg-muted">{isToday ? t("Nothing scheduled today.") : t("Nothing scheduled that day.")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {slots.map((s) => {
              const overdue = isToday && !s.dose && s.time < now;
              return (
                <li key={`${s.medicine.id}-${s.time}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="mr-2 font-mono text-sm text-fg-muted">{s.time}</span>
                      {s.medicine.name} {s.medicine.strength ? <span className="text-fg-muted">{s.medicine.strength}</span> : null}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {doseLabel(s.medicine)}
                      {s.medicine.instructions ? ` · ${s.medicine.instructions}` : ""}
                      {startedLater.has(s.medicine.id) ? ` · ${t("added later; logging moves its start date back")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.dose ? (
                      <Badge tone={s.dose.status === "taken" ? "accent" : "warn"}>
                        {s.dose.status === "taken" ? `✓ ${t("taken")} ${localTime(s.dose.taken_at, tz)}` : t("skipped")}
                      </Badge>
                    ) : overdue ? (
                      <Badge tone="danger">{t("due")}</Badge>
                    ) : null}
                    {canWrite ? (
                      <DoseButtons medicineId={s.medicine.id} ownerId={ownerId} date={date} time={s.time} doseId={s.dose?.id ?? null} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {asNeeded.length ? (
        <Card>
          <h2 className="mb-2 font-semibold">{t("As needed")}</h2>
          <ul className="divide-y divide-border">
            {asNeeded.map((m) => {
              const taken = doses.filter((d) => d.medicine_id === m.id && d.status === "taken");
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-fg-muted">
                      {doseLabel(m)}
                      {taken.length ? ` · ${isToday ? t("taken today at") : t("taken that day at")} ${taken.map((d) => localTime(d.taken_at, tz)).join(", ")}` : ""}
                    </p>
                  </div>
                  {canWrite ? <AsNeededButton medicineId={m.id} ownerId={ownerId} date={date} /> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
