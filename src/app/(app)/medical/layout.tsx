import { notFound } from "next/navigation";
import { getSession, logPartnerView } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/ui";
import { SubNav } from "@/components/sub-nav";

export default async function MedicalLayout({ children }: LayoutProps<"/medical">) {
  const session = await getSession();
  if (!session.isModuleEnabled("medical_records")) notFound();

  const subject = session.subject;
  const access = session.accessTo("medical_records", subject.user_id);
  const isSelf = subject.user_id === session.userId;

  if (access === "none") {
    return (
      <>
        <PageHeader title="Medical records" />
        <EmptyState title={`${subject.display_name} hasn't shared medical records with you`}>
          They can share them from Settings → Sharing. Switch back to Personal to see your own.
        </EmptyState>
      </>
    );
  }
  await logPartnerView(session, "medical_records");

  return (
    <>
      <PageHeader
        title={isSelf ? "Medical records" : `${subject.display_name}'s medical records`}
        subtitle={
          isSelf
            ? "Your history, blood work, hospital papers and reports, and a timeline of everything health-related. AI suggestions use it unless you switch it off."
            : access === "write"
              ? "Shared with you: you can view and add entries."
              : "Shared with you: view only."
        }
      />
      <SubNav
        items={[
          { href: "/medical", label: "Timeline" },
          { href: "/medical/labs", label: "Blood work & labs" },
          { href: "/medical/documents", label: "Papers & reports" },
          { href: "/medical/profile", label: "Health profile" },
        ]}
      />
      {children}
    </>
  );
}
