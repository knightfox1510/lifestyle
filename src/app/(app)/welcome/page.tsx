import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card } from "@/components/ui";
import { ModuleIcon } from "@/components/icons";
import { InstallPrompt } from "@/components/install-prompt";
import { MODULES, SHARE_ONLY } from "@/modules/registry";
import { getT } from "@/lib/i18n/server";
import { MyFeatureToggle } from "../settings/features/toggle";
import { ShareSelect } from "../settings/sharing/share-select";
import { WelcomeSteps } from "./steps";

export const metadata = { title: "Welcome" };

/** Everyday things most couples share; sensitive ones are left for Settings → Sharing. */
const EVERYDAY = ["water", "food_diary", "checkin", "medicines", "supplements", "body_recomp", "fitness", "wearables"];

export default async function WelcomePage() {
  const session = await getSession();
  const t = await getT(session);
  const features = MODULES.filter((m) => m.href && session.isModuleEnabled(m.key));
  const partner = session.partner;
  const level = (key: string) => session.shares.find((s) => s.owner_id === session.userId && s.grantee_id === partner?.user_id && s.module_key === key)?.level ?? "none";
  const shareable = EVERYDAY.map((k) => MODULES.find((m) => m.key === k) ?? SHARE_ONLY.find((m) => m.key === k)).filter((m): m is NonNullable<typeof m> => Boolean(m) && (m!.key === "water" || session.isModuleEnabled(m!.key)));

  return (
    <div className="mx-auto max-w-lg">
      <WelcomeSteps
        steps={[
          {
            title: t("Pick what you'll use"),
            intro: t("Turn off anything you don't need. It only changes your own menus and Today; nothing is deleted and you can change it any time in Settings."),
            body: (
              <Card className="!p-0">
                <ul className="max-h-[55vh] divide-y divide-border overflow-auto">
                  {features.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2"><ModuleIcon moduleKey={m.key} /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{t(m.name)}</span>
                          <span className="block truncate text-xs text-fg-muted">{t(m.description)}</span>
                        </span>
                      </span>
                      <MyFeatureToggle moduleKey={m.key} on={!session.isHiddenFor(m.key, session.userId)} label={t(m.name)} />
                    </li>
                  ))}
                </ul>
              </Card>
            ),
          },
          {
            title: partner ? t("Share with {name}", { name: partner.display_name }) : t("Share with your partner"),
            intro: partner
              ? t("Your health data is private until you share it. “Can view” shows it on their phone; “Can edit” also lets them log for you (a meal you shared, a medicine they gave you).")
              : t("Invite your partner from Settings → Household; then you can choose what they can see."),
            body: partner ? (
              <Card className="!p-0">
                <ul className="divide-y divide-border">
                  {shareable.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium"><span aria-hidden>{m.icon}</span> {t(m.name)}</span>
                      <ShareSelect granteeId={partner.user_id} moduleKey={m.key} value={level(m.key)} />
                    </li>
                  ))}
                </ul>
                <p className="px-4 pb-3 pt-1 text-xs text-fg-muted">{t("Sensitive things (bladder diary, cycle, medical records) are in")} <Link href="/settings/sharing" className="text-accent underline">{t("Settings → Sharing")}</Link>.</p>
              </Card>
            ) : (
              <Link href="/settings/household" className="text-sm text-accent underline">{t("Invite your partner")}</Link>
            ),
          },
          {
            title: t("Put Hearth on your home screen"),
            intro: t("Installed, it opens like an app and can remind you about medicines, water and the evening check-in."),
            body: (
              <div className="space-y-3">
                <InstallPrompt />
                <Link href="/settings/notifications" className="block rounded-2xl bg-surface px-4 py-3 text-sm shadow-[0_0_0_1px_var(--border)] hover:bg-surface-2/50">
                  🔔 <strong>{t("Turn on reminders")}</strong> <span className="text-fg-muted">· {t("medicines, water, check-in, quiet hours")}</span>
                </Link>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
