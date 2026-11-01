import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSession, logPartnerView } from "@/lib/session";
import { MODULE_BY_KEY } from "@/modules/registry";
import { EmptyState, PageHeader } from "@/components/ui";
import { SubNav } from "@/components/sub-nav";
import { getT } from "@/lib/i18n/server";

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
  const t = await getT(session);
  const name = t(def.name);
  if (subtitle) subtitle = t(subtitle);

  const header = <>{tabs ? <SubNav items={tabs.map((x) => ({ ...x, label: t(x.label) }))} /> : null}</>;

  if (def.scope === "household") {
    return (
      <>
        <PageHeader title={name} subtitle={subtitle} />
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
        <PageHeader title={name} />
        <EmptyState title={t("{person} hasn't shared {module} with you", { person: subject.display_name, module: name })}>
          {t("They can share it from Settings → Sharing. Switch back to Personal to see your own.")}
        </EmptyState>
      </>
    );
  }
  await logPartnerView(session, moduleKey);

  return (
    <>
      <PageHeader
        title={isSelf ? name : `${subject.display_name} · ${name}`}
        subtitle={isSelf ? subtitle : access === "write" ? t("Shared with you: you can view and add entries.") : t("Shared with you: view only.")}
      />
      {header}
      {children}
    </>
  );
}
