import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { HubGrid, HubList } from "@/components/hub";
import { MODULES } from "@/modules/registry";
import { getT } from "@/lib/i18n/server";
import { hubStatuses } from "@/lib/hub-status";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = { title: "Family" };

export default async function MeHub() {
  const session = await getSession();
  const t = await getT(session);
  const status = await hubStatuses(session, t);
  const tile = (keys: string[]) =>
    MODULES.filter((m) => keys.includes(m.group) && m.href && session.isShown(m.key) && m.key !== "food_diary").map((m) => ({
      href: m.href!,
      iconKey: m.key,
      name: t(m.name),
      status: status[m.key]?.text ?? null,
      alert: status[m.key]?.alert,
      count: status[m.key]?.count,
    }));
  return (
    <div className="space-y-6">
      <PageHeader title={session.household.name} subtitle={[session.me.display_name, session.partner?.display_name].filter(Boolean).join(" & ")} />
      <HubGrid title={t("Home & family")} items={tile(["Family & home"])} />
      <HubGrid title={t("Plans & fun")} items={tile(["Leisure"]).filter((i) => i.iconKey !== "dining")} />
      <HubGrid title={t("Paperwork")} items={tile(["Admin"])} />
      <HubList title={t("Kitchen")} items={[{ href: "/food/plan", name: t("Food & kitchen"), hint: t("Week plan, groceries, pantry, recipes and eating out are under the Food tab") }]} />
      <HubList
        title={t("You")}
        items={[
          { href: "/digest/wrap", name: t("Your week"), hint: t("Streaks, doses, water and cheers") },
          { href: "/assistant", name: t("Ask AI"), hint: t("Suggestions that use your health data") },
          { href: "/settings", name: t("Settings"), hint: t("Language, Home view, profile") },
          { href: "/settings/notifications", name: t("Notifications"), hint: t("Reminders, water, close your day") },
          { href: "/settings/features", name: t("My features"), hint: t("Hide what you don't use") },
          { href: "/settings/sharing", name: t("Sharing"), hint: t("What your partner can see") },
          { href: "/settings/household", name: t("Household"), hint: t("Members, invites, features on/off") },
          { href: "/customize", name: t("Home widgets"), hint: t("Extra cards under your day") },
        ]}
      />
      <SignOutButton />
    </div>
  );
}
