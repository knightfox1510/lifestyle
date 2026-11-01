import Link from "next/link";
import { getSession } from "@/lib/session";
import { localTime, todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState, Notice } from "@/components/ui";
import type { Medicine, MedicineDose } from "@/lib/types";
import { doseLabel, refillInfo, slotsForDay } from "@/modules/medicines/logic";
import { DoseButtons, AsNeededButton } from "./dose-buttons";
import { getT } from "@/lib/i18n/server";
import { medicineChecksFor } from "@/lib/medicine-checks";

export const metadata = { title: "Medicines" };

export default async function MedicinesTodayPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const canWrite = session.accessTo("medicines", ownerId) === "write";
  const t = await getT(session);

  const [{ data: medData }, { data: doseData }] = await Promise.all([
    session.supabase.from("medicines").select("*").eq("owner_id", ownerId).eq("active", true).order("name"),
    session.supabase.from("medicine_doses").select("*").eq("owner_id", ownerId).eq("scheduled_date", today),
  ]);
  const meds = (medData ?? []) as Medicine[];
  const doses = (doseData ?? []) as MedicineDose[];
  const slots = slotsForDay(meds, doses, today);
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

  return (
    <div className="space-y-4">
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
          <h2 className="font-semibold">{t("Today's doses")}</h2>
          <span className="text-sm text-fg-muted">
            {t("{done}/{total} done", { done, total: slots.length })}
          </span>
        </div>
        {slots.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("Nothing scheduled today.")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {slots.map((s) => {
              const overdue = !s.dose && s.time < now;
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
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.dose ? (
                      <Badge tone={s.dose.status === "taken" ? "accent" : "warn"}>
                        {s.dose.status === "taken" ? `✓ taken ${localTime(s.dose.taken_at, tz)}` : "skipped"}
                      </Badge>
                    ) : overdue ? (
                      <Badge tone="danger">{t("due")}</Badge>
                    ) : null}
                    {canWrite ? (
                      <DoseButtons medicineId={s.medicine.id} ownerId={ownerId} date={today} time={s.time} doseId={s.dose?.id ?? null} />
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
                      {taken.length ? ` · taken today at ${taken.map((d) => localTime(d.taken_at, tz)).join(", ")}` : ""}
                    </p>
                  </div>
                  {canWrite ? <AsNeededButton medicineId={m.id} ownerId={ownerId} date={today} /> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
