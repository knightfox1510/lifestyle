import { getSession } from "@/lib/session";
import { MODULES } from "@/modules/registry";
import { AppNav, type NavGroup, type NavItem } from "@/components/app-nav";
import { ToastProvider } from "@/components/toaster";
import { PartnerViewBanner, ViewSwitch } from "@/components/view-switch";
import { AppLockGate } from "@/components/app-lock";
import { I18nProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  const lang = await getLang(session);
  const t = makeT(lang);
  const enabled = MODULES.filter((m) => m.href && session.isModuleEnabled(m.key));
  const groupOrder = ["Health", "Food", "Family & home", "Leisure", "Admin"] as const;
  const groups: NavGroup[] = [
    { title: null, items: [{ href: "/", label: t("Today"), icon: "today" }, { href: "/assistant", label: t("Ask AI"), icon: "ai" }] },
    ...groupOrder
      .map((g) => ({ title: t(g), items: enabled.filter((m) => m.group === g).map((m) => ({ href: m.href!, label: t(m.name), icon: m.key })) }))
      .filter((g) => g.items.length),
    { title: null, items: [{ href: "/settings", label: t("Settings"), icon: "settings" }] },
  ];
  // Phones: Today · Health · ＋ · Food · Me. Everything else lives in the Health and Me hubs.
  const tabs: NavItem[] = [
    { href: "/", label: t("Today"), icon: "today" },
    { href: "/health", label: t("Health"), icon: "health" },
    { href: session.isModuleEnabled("food_diary") ? "/food" : "/groceries", label: t("Food"), icon: "food" },
    { href: "/me", label: t("Family"), icon: "me" },
  ];
  const quickLog = {
    ownerId: session.userId,
    medicines: session.isModuleEnabled("medicines"),
    bladder: session.isModuleEnabled("bladder_diary"),
    body: session.isModuleEnabled("body_recomp"),
    checkin: session.isModuleEnabled("checkin"),
    food: session.isModuleEnabled("food_diary"),
  };

  return (
    <I18nProvider lang={lang}>
    <ToastProvider>
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr] print:block">
      <AppNav groups={groups} tabs={tabs} householdName={session.household.name} quickLog={quickLog} logLabel={t("Log")} />
      <div className="min-w-0 pb-28 md:pb-8 print:pb-0">
        <div className="sticky top-0 z-20 print:hidden">
        <header className="flex items-center justify-between gap-3 bg-bg/80 px-4 py-3 backdrop-blur-xl md:px-8">
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
        {session.viewMode === "partner" && session.partner ? <PartnerViewBanner partnerName={session.partner.display_name} /> : null}
        </div>
        <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">{children}</main>
      </div>
      <AppLockGate />
    </div>
    </ToastProvider>
    </I18nProvider>
  );
}
