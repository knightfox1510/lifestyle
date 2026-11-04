import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { HubGrid, HubList } from "@/components/hub";
import { MODULES } from "@/modules/registry";
import { getT } from "@/lib/i18n/server";
import { hubStatuses } from "@/lib/hub-status";
import { HealthScoreCard } from "@/components/health-score";
import { loadDays, waterSettings } from "@/lib/today";
import { waterAccess } from "@/lib/water";
import { todayIn } from "@/lib/dates";
import { ClipboardList, FileText, FlaskConical, ShieldCheck } from "lucide-react";

export const metadata = { title: "Health" };

export default async function HealthHub() {
  const session = await getSession();
  const t = await getT(session);
  const subject = session.subject.user_id;
  const can = (m: string) => session.isShown(m) && session.accessTo(m, subject) !== "none";
  const tz = session.profile.timezone;
  const isSelf = subject === session.userId;
  const [status, water] = await Promise.all([hubStatuses(session, t), waterSettings(session.supabase, subject)]);
  const waterAcc = isSelf ? "write" : waterAccess(session, subject);
  const days = await loadDays(session.supabase, subject, {
    tz,
    today: todayIn(tz),
    days: 14,
    enabled: { medicines: can("medicines"), food: can("food_diary"), checkin: can("checkin"), supplements: can("supplements"), water: waterAcc !== "none" },
    waterTarget: water.target,
    supplementTimes: session.profile.supplement_times,
  });
  const tile = (keys: string[]) =>
    keys
      .map((k) => MODULES.find((m) => m.key === k))
      .filter((m): m is NonNullable<typeof m> => Boolean(m?.href && session.isShown(m.key)))
      .map((m) => ({ href: m.href!, iconKey: m.key, name: t(m.name), status: status[m.key]?.text ?? null, alert: status[m.key]?.alert, count: status[m.key]?.count }));
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
    ...(session.isShown("medical_records") ? [{ href: "/medical/visit", name: t("Doctor visit summary"), hint: t("One page to show or send your doctor"), icon: <FileText />, tint: "var(--accent)" }] : []),
    ...(session.isShown("medicines") ? [{ href: "/medicines/checks", name: t("Safety checks"), hint: t("Interactions, duplicates and timing"), icon: <ShieldCheck />, tint: "var(--cat-meds)" }] : []),
    ...(session.isShown("medical_records") ? [{ href: "/medical/labs", name: t("Blood work & labs"), hint: t("Results and trends"), icon: <FlaskConical />, tint: "var(--danger)" }] : []),
    ...(session.isShown("bladder_diary") ? [{ href: "/bladder/report", name: t("Bladder diary report"), hint: t("For your doctor or physio"), icon: <ClipboardList />, tint: "var(--cat-water)" }] : []),
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t("Health")} subtitle={t("Medicines, records and daily health tracking.")} />
      <HealthScoreCard statuses={days.statuses} t={t} />
      {sections.map(([title, keys]) => (
        <HubGrid key={title} title={t(title)} items={tile(keys)} />
      ))}
      <HubGrid title={t("More")} items={tile(more)} />
      {tools.length ? <HubList title={t("Reports & tools")} items={tools} /> : null}
    </div>
  );
}
