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
  const tile = (keys: string[]) =>
    keys
      .map((k) => MODULES.find((m) => m.key === k))
      .filter((m): m is NonNullable<typeof m> => Boolean(m?.href && session.isShown(m.key)))
      .map((m) => ({ href: m.href!, iconKey: m.key, name: t(m.name), status: status[m.key]?.text ?? null, alert: status[m.key]?.alert }));
  // Related features sit together; anything new in the Health group lands in "More".
  const sections: [string, string[]][] = [
    ["Every day", ["medicines", "supplements", "checkin", "habits"]],
    ["Bladder & pelvic health", ["bladder_diary", "pelvic_floor", "cycle"]],
    ["Body & activity", ["body_recomp", "fitness", "wearables"]],
    ["Records", ["medical_records"]],
  ];
  const placed = new Set(sections.flatMap(([, k]) => k));
  const more = MODULES.filter((m) => m.group === "Health" && !placed.has(m.key)).map((m) => m.key);
  const tools = [
    ...(session.isShown("medical_records") ? [{ href: "/medical/visit", name: t("Doctor visit summary"), hint: t("One page to show or send your doctor") }] : []),
    ...(session.isShown("medicines") ? [{ href: "/medicines/checks", name: t("Safety checks"), hint: t("Interactions, duplicates and timing") }] : []),
    ...(session.isShown("medical_records") ? [{ href: "/medical/labs", name: t("Blood work & labs"), hint: t("Results and trends") }] : []),
    ...(session.isShown("bladder_diary") ? [{ href: "/bladder/report", name: t("Bladder diary report"), hint: t("For your doctor or physio") }] : []),
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t("Health")} subtitle={t("Medicines, records and daily health tracking.")} />
      {sections.map(([title, keys]) => (
        <HubGrid key={title} title={t(title)} items={tile(keys)} />
      ))}
      <HubGrid title={t("More")} items={tile(more)} />
      {tools.length ? <HubList title={t("Reports & tools")} items={tools} /> : null}
    </div>
  );
}
