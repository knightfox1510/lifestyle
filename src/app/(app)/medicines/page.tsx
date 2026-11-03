import Link from "next/link";
import { getSession } from "@/lib/session";
import { addDays, localDate, localTime, shortDate, todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, Notice, buttonClass } from "@/components/ui";
import { DateJump } from "@/components/date-jump";
import type { Medicine, MedicineDose } from "@/lib/types";
import { doseLabel, isCurrentOn, isUpcomingOn, refillInfo, slotsForDay } from "@/modules/medicines/logic";
import { DoseButtons, AsNeededButton } from "./dose-buttons";
import { SupplementTakeButton } from "@/app/(app)/supplements/take-button";
import { TIMING_LABEL, supplementRepeat, timingTimes } from "@/modules/supplements/meta";
import type { Supplement } from "@/lib/types";
import { isDueOn } from "@/modules/schedule";
import { updateDose } from "./actions";
import { EditRecord } from "@/components/edit-record";
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

  const suppsOn = session.isShown("supplements") && session.accessTo("supplements", ownerId) !== "none";
  const suppWrite = session.accessTo("supplements", ownerId) === "write";
  const [{ data: medData }, { data: doseData }, suppRes, suppLogRes] = await Promise.all([
    session.supabase.from("medicines").select("*").eq("owner_id", ownerId).eq("active", true).order("name"),
    session.supabase.from("medicine_doses").select("*").eq("owner_id", ownerId).eq("scheduled_date", date),
    suppsOn ? session.supabase.from("supplements").select("*").eq("owner_id", ownerId).eq("active", true).order("sort") : Promise.resolve({ data: [] }),
    suppsOn ? session.supabase.from("supplement_logs").select("supplement_id, taken_at").eq("owner_id", ownerId).eq("log_date", date) : Promise.resolve({ data: [] }),
  ]);
  // Supplements for this day, in schedule order (by their usual time; "any time" ones last).
  const sTimes = timingTimes(session.profile.supplement_times);
  const supps = ((suppRes.data ?? []) as (Supplement & { created_at: string })[])
    .filter((x) => isDueOn(supplementRepeat(x, (iso) => localDate(iso, tz)), date))
    .sort((a, b) => (sTimes[a.timing] ?? "99").localeCompare(sTimes[b.timing] ?? "99"));
  const suppTaken = new Map(((suppLogRes.data ?? []) as { supplement_id: string; taken_at: string }[]).map((l) => [l.supplement_id, l.taken_at]));
  const meds = (medData ?? []) as Medicine[];
  const doses = (doseData ?? []) as MedicineDose[];
  // On an earlier day, also show medicines whose start date was set later but has already come
  // (you may have been taking them before adding them). Future courses never show.
  const startedLater = new Set(isToday ? [] : meds.filter((m) => m.start_date > date && m.start_date <= today).map((m) => m.id));
  const slots = slotsForDay(isToday ? meds : meds.map((m) => (startedLater.has(m.id) ? { ...m, start_date: date } : m)), doses, date);
  // Only medicines current on this day; ones starting later are listed separately.
  const asNeeded = meds.filter((m) => m.times.length === 0 && (isCurrentOn(m, date) || startedLater.has(m.id)));
  const upcoming = isToday ? meds.filter((m) => isUpcomingOn(m, today)) : [];
  const lowStock = meds.filter((m) => isCurrentOn(m, today)).map((m) => ({ m, r: refillInfo(m) })).filter((x) => x.r?.low);
  const now = localTime(new Date(), tz);
  const done = slots.filter((s) => s.dose).length;
  const serious = meds.length ? (await medicineChecksFor(session, ownerId)).findings.filter((f) => f.severity === "high") : [];

  if (meds.length === 0 && supps.length === 0) {
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {s.dose ? (
                      <Badge tone={s.dose.status === "taken" ? "accent" : "warn"}>
                        {s.dose.status === "taken" ? `✓ ${t("taken")} ${localTime(s.dose.taken_at, tz)}` : t("skipped")}
                      </Badge>
                    ) : overdue ? (
                      <Badge tone="danger">{t("due")}</Badge>
                    ) : null}
                    {canWrite && s.dose ? (
                      <EditRecord
                        label="Fix this dose"
                        fields={[
                          { name: "status", label: "Dose", type: "select", options: [{ value: "taken", label: "Taken" }, { value: "skipped", label: "Skipped" }] },
                          { name: "time", label: "Time taken", type: "time" },
                        ]}
                        values={{ status: s.dose.status, time: localTime(s.dose.taken_at, tz) }}
                        onSave={updateDose.bind(null, s.dose.id, ownerId)}
                      />
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

      {supps.length ? (
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">{isToday ? t("Supplements today") : t("Supplements on {date}", { date: shortDate(date) })}</h2>
            <span className="text-sm text-fg-muted">{t("{done}/{total} done", { done: supps.filter((x) => suppTaken.has(x.id)).length, total: supps.length })}</span>
          </div>
          <ul className="divide-y divide-border">
            {supps.map((x) => {
              const time = sTimes[x.timing];
              const takenAt = suppTaken.get(x.id);
              const late = isToday && !takenAt && time !== null && time < now;
              return (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="mr-2 font-mono text-sm text-fg-muted">{time ?? "—"}</span>
                      {x.name} {x.dose ? <span className="text-fg-muted">{x.dose}</span> : null}
                    </p>
                    <p className="text-xs text-fg-muted">{t(TIMING_LABEL[x.timing])}{takenAt ? ` · ${t("taken")} ${localTime(takenAt, tz)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {late ? <Badge tone="warn">{t("due")}</Badge> : null}
                    {suppWrite ? <SupplementTakeButton key={`${x.id}-${date}-${Boolean(takenAt)}`} supplementId={x.id} ownerId={ownerId} date={date} name={x.name} taken={Boolean(takenAt)} /> : takenAt ? <Badge tone="accent">✓</Badge> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-fg-muted">
            {t("Times come from each supplement's timing.")} <Link href="/settings/times" className="text-accent underline">{t("Change times")}</Link> · <Link href="/supplements" className="text-accent underline">{t("Manage supplements")}</Link>
          </p>
        </Card>
      ) : null}

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

      {upcoming.length ? (
        <Card>
          <h2 className="mb-2 font-semibold">{t("Starting later")}</h2>
          <ul className="divide-y divide-border">
            {upcoming.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{m.name}</span> {m.strength ? <span className="text-fg-muted">{m.strength}</span> : null}
                </span>
                <Badge>{t("starts {date}", { date: shortDate(m.start_date) })}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
