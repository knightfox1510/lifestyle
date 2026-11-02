import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { ModuleIcon } from "@/components/icons";
import { MODULES } from "@/modules/registry";
import { getT } from "@/lib/i18n/server";
import { MyFeatureToggle } from "./toggle";

export const metadata = { title: "My features" };

const GROUPS = ["Health", "Food", "Family & home", "Leisure", "Admin"] as const;

/** Each person picks which household features they use; the rest leave their menus and Today. */
export default async function MyFeaturesPage() {
  const session = await getSession();
  const t = await getT(session);
  const on = MODULES.filter((m) => m.href && session.isModuleEnabled(m.key));
  return (
    <div className="space-y-4">
      <PageHeader title={t("My features")} subtitle={t("Turn off what you don't use. It only changes your own menus and Today; your partner keeps theirs, and nothing is deleted.")} />
      {GROUPS.map((g) => {
        const list = on.filter((m) => m.group === g);
        if (!list.length) return null;
        return (
          <Card key={g} className="!p-0">
            <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-fg-muted">{t(g)}</p>
            <ul className="divide-y divide-border">
              {list.map((m) => (
                <li key={m.key} className="flex items-center justify-between gap-3 px-4 py-3">
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
        );
      })}
      <p className="text-xs text-fg-muted">
        {t("To switch a feature off for the whole household, use")} <Link href="/settings/household" className="text-accent underline">{t("Settings → Household")}</Link>.
      </p>
    </div>
  );
}
