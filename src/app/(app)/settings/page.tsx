import { getSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";
import { InstallPrompt } from "@/components/install-prompt";
import { FeedbackSettings } from "@/components/feedback-settings";
import { HubList } from "@/components/hub";
import { ProfileSettingsForm } from "./profile-settings-form";
import { getT } from "@/lib/i18n/server";
import { Bell, Clock, Home, LayoutGrid, Lock, SlidersHorizontal, Sparkles, Users } from "lucide-react";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSession();
  const t = await getT(session);
  return (
    <>
      <PageHeader title={t("Settings")} subtitle={session.email ?? undefined} />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-semibold">{t("You")}</h2>
          <ProfileSettingsForm profile={session.profile} />
        </Card>
        <HubList
          title={t("Household & sharing")}
          items={[
            { href: "/settings/household", name: t("Household"), hint: t("Members, invites, features on/off, AI key and limits."), icon: <Home />, tint: "var(--accent)" },
            { href: "/settings/sharing", name: t("Sharing"), hint: t("Choose what your partner can see or edit, and who viewed it."), icon: <Users />, tint: "var(--cat-water)" },
          ]}
        />
        <HubList
          title={t("Your app")}
          items={[
            { href: "/settings/features", name: t("My features"), hint: t("Hide what you don't use from your own menus and Today."), icon: <SlidersHorizontal />, tint: "var(--cat-check)" },
            { href: "/settings/times", name: t("Supplement times"), hint: t("What morning, with a meal, bedtime… mean for you"), icon: <Clock />, tint: "var(--cat-meds)" },
            { href: "/settings/notifications", name: t("Notifications"), hint: t("Turn on push for this device; choose reminders and quiet hours."), icon: <Bell />, tint: "var(--sun)" },
            { href: "/digest", name: t("Weekly summary"), hint: t("AI recap of your week, every Sunday evening."), icon: <Sparkles />, tint: "var(--accent)" },
            { href: "/customize", name: t("Home widgets"), hint: t("Pick and arrange the quick-log widgets on Home."), icon: <LayoutGrid />, tint: "var(--cat-food)" },
            { href: "/settings/privacy", name: t("Privacy & data"), hint: t("App lock, download your data, delete your account."), icon: <Lock />, tint: "var(--fg-muted)" },
          ]}
        />
        <FeedbackSettings />
        <InstallPrompt />
        <SignOutButton />
        <p className="pt-2 text-center text-[12px] text-fg-muted">
          {t("Version")} {(process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7)}
        </p>
      </div>
    </>
  );
}
