import { getSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { SUPPLEMENT_TIMINGS } from "@/lib/types";
import { TIMING_LABEL, TIMING_TIME, timingTimes } from "@/modules/supplements/meta";
import { getT } from "@/lib/i18n/server";
import { TimesForm } from "./times-form";

export const metadata = { title: "Supplement times" };

export default async function TimesPage() {
  const session = await getSession();
  const t = await getT(session);
  const mine = timingTimes(session.profile.supplement_times);
  return (
    <div className="space-y-4">
      <PageHeader title={t("Supplement times")} subtitle={t("When “Morning”, “With a meal”, “Bedtime”… mean for you. Used for Today's schedule, Next up and reminders. Only changes your own.")} />
      <Card>
        <TimesForm
          rows={SUPPLEMENT_TIMINGS.map((k) => ({ key: k, label: t(TIMING_LABEL[k]), value: session.profile.supplement_times?.[k] ?? "", placeholder: TIMING_TIME[k] ?? "", effective: mine[k] }))}
        />
      </Card>
      <p className="text-xs text-fg-muted">{t("Medicines use the exact times set on each medicine (Medicines → Medicines → Edit).")}</p>
    </div>
  );
}
