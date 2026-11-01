import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { HubGrid, HubList } from "@/components/hub";
import { MODULES } from "@/modules/registry";
import { getT } from "@/lib/i18n/server";
import { hubStatuses } from "@/lib/hub-status";

export const metadata = { title: "Health" };

export default async function HealthHub() {
  const session = await getSession();
  const t = await getT(session);
  const status = await hubStatuses(session, t);
  const items = MODULES.filter((m) => m.group === "Health" && m.href && session.isModuleEnabled(m.key)).map((m) => ({
    href: m.href!,
    iconKey: m.key,
    name: t(m.name),
    status: status[m.key]?.text ?? null,
    alert: status[m.key]?.alert,
  }));
  const tools = [
    ...(session.isModuleEnabled("medical_records") ? [{ href: "/medical/visit", name: t("Doctor visit summary"), hint: t("One page to show or send your doctor") }] : []),
    ...(session.isModuleEnabled("medicines") ? [{ href: "/medicines/checks", name: t("Safety checks"), hint: t("Interactions, duplicates and timing") }] : []),
    ...(session.isModuleEnabled("medical_records") ? [{ href: "/medical/labs", name: t("Blood work & labs"), hint: t("Results and trends") }] : []),
    ...(session.isModuleEnabled("bladder_diary") ? [{ href: "/bladder/report", name: t("Bladder diary report"), hint: t("For your doctor or physio") }] : []),
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t("Health")} subtitle={t("Medicines, records and daily health tracking.")} />
      <HubGrid items={items} />
      {tools.length ? <HubList title={t("Reports & tools")} items={tools} /> : null}
    </div>
  );
}
