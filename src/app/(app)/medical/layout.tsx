import { notFound } from "next/navigation";
import { getSession, logPartnerView } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/ui";
import { SubNav } from "@/components/sub-nav";
import { getT } from "@/lib/i18n/server";

export default async function MedicalLayout({ children }: LayoutProps<"/medical">) {
  const session = await getSession();
  if (!session.isModuleEnabled("medical_records")) notFound();
  const t = await getT(session);

  const subject = session.subject;
  const access = session.accessTo("medical_records", subject.user_id);
  const isSelf = subject.user_id === session.userId;

  if (access === "none") {
    return (
      <>
        <PageHeader title={t("Medical records")} />
        <EmptyState title={t("{person} hasn't shared {module} with you", { person: subject.display_name, module: t("Medical records") })}>
          {t("They can share it from Settings → Sharing. Switch back to Personal to see your own.")}
        </EmptyState>
      </>
    );
  }
  await logPartnerView(session, "medical_records");

  return (
    <>
      <PageHeader
        title={isSelf ? t("Medical records") : `${subject.display_name} · ${t("Medical records")}`}
        subtitle={
          isSelf
            ? t("Your history, blood work, hospital papers and reports, and a timeline of everything health-related. AI suggestions use it unless you switch it off.")
            : access === "write"
              ? t("Shared with you: you can view and add entries.")
              : t("Shared with you: view only.")
        }
      />
      <SubNav
        items={[
          { href: "/medical", label: t("Timeline") },
          { href: "/medical/labs", label: t("Blood work & labs") },
          { href: "/medical/documents", label: t("Papers & reports") },
          { href: "/medical/profile", label: t("Health profile") },
          { href: "/medical/visit", label: t("Doctor visit summary") },
        ]}
      />
      {children}
    </>
  );
}
