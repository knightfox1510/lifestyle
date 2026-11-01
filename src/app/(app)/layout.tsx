import { getSession } from "@/lib/session";
import { MODULES } from "@/modules/registry";
import { AppNav, type NavItem } from "@/components/app-nav";
import { ViewSwitch } from "@/components/view-switch";
import { AppLockGate } from "@/components/app-lock";
import { I18nProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  const lang = await getLang(session);
  const t = makeT(lang);
  const moduleItems: NavItem[] = MODULES.filter((m) => m.href && session.isModuleEnabled(m.key)).map((m) => ({
    href: m.href!,
    label: t(m.name),
    icon: m.icon,
  }));
  const items: NavItem[] = [
    { href: "/", label: t("Home"), icon: "🏠" },
    ...moduleItems,
    { href: "/assistant", label: t("Ask AI"), icon: "✨" },
    { href: "/settings", label: t("Settings"), icon: "⚙️" },
  ];
  // Phones get a fixed five-slot bar; every feature is reachable from "More".
  const groceries = moduleItems.find((i) => i.href === "/groceries");
  const mobileItems: NavItem[] = [
    { href: "/", label: t("Home"), icon: "🏠" },
    groceries ?? moduleItems[0],
    { href: "/assistant", label: t("Ask AI"), icon: "✨" },
    { href: "/more", label: t("More"), icon: "☰" },
    { href: "/settings", label: t("Settings"), icon: "⚙️" },
  ].filter(Boolean) as NavItem[];

  return (
    <I18nProvider lang={lang}>
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr] print:block">
      <AppNav items={items} mobileItems={mobileItems} householdName={session.household.name} />
      <div className="min-w-0 pb-24 md:pb-8 print:pb-0">
        <header className="sticky top-0 z-20 print:hidden flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="min-w-0 md:hidden">
            <p className="truncate text-sm font-semibold">{session.household.name}</p>
          </div>
          <div className="hidden text-sm text-fg-muted md:block">
            {t("Signed in as")} <span className="font-medium text-fg">{session.me.display_name}</span>
          </div>
          <ViewSwitch
            mode={session.viewMode}
            meName={session.me.display_name}
            partnerName={session.partner?.display_name ?? null}
          />
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">{children}</main>
      </div>
      <AppLockGate />
    </div>
    </I18nProvider>
  );
}
