import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSession, logPartnerView } from "@/lib/session";
import { MODULE_BY_KEY } from "@/modules/registry";
import { EmptyState, PageHeader } from "@/components/ui";
import { SubNav } from "@/components/sub-nav";

/**
 * Shared wrapper for a module's screens: checks the module is on, handles the
 * Personal/Partner view (shows a notice if the partner hasn't shared), records
 * partner views in the audit log, and renders the header + tabs.
 */
export async function ModuleShell({
  moduleKey,
  subtitle,
  tabs,
  children,
}: {
  moduleKey: string;
  subtitle?: string;
  tabs?: { href: string; label: string }[];
  children: ReactNode;
}) {
  const session = await getSession();
  const def = MODULE_BY_KEY[moduleKey];
  if (!def || !session.isModuleEnabled(moduleKey)) notFound();

  const header = <>{tabs ? <SubNav items={tabs} /> : null}</>;

  if (def.scope === "household") {
    return (
      <>
        <PageHeader title={def.name} subtitle={subtitle} />
        {header}
        {children}
      </>
    );
  }

  const subject = session.subject;
  const isSelf = subject.user_id === session.userId;
  const access = session.accessTo(moduleKey, subject.user_id);
  if (access === "none") {
    return (
      <>
        <PageHeader title={def.name} />
        <EmptyState title={`${subject.display_name} hasn't shared ${def.name.toLowerCase()} with you`}>
          They can share it from Settings → Sharing. Switch back to Personal to see your own.
        </EmptyState>
      </>
    );
  }
  await logPartnerView(session, moduleKey);

  return (
    <>
      <PageHeader
        title={isSelf ? def.name : `${subject.display_name} · ${def.name}`}
        subtitle={isSelf ? subtitle : access === "write" ? "Shared with you: you can view and add entries." : "Shared with you: view only."}
      />
      {header}
      {children}
    </>
  );
}
