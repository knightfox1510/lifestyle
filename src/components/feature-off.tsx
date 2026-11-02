import { Card } from "@/components/ui";
import { setViewMode } from "@/app/(app)/view-actions";
import { setModuleHiddenForMe } from "@/app/(app)/settings/actions";

/** Shown instead of a feature someone switched off for themselves, with a way to their partner's or to turn it back on. */
export function FeatureOff({
  name,
  moduleKey,
  isSelf,
  personName,
  partner,
}: {
  name: string;
  moduleKey: string;
  isSelf: boolean;
  personName: string;
  /** The partner, when they use this feature and you can see it. */
  partner: { name: string } | null;
}) {
  const turnOn = async () => {
    "use server";
    await setModuleHiddenForMe(moduleKey, false);
  };
  const seePartner = async () => {
    "use server";
    await setViewMode("partner");
  };
  const backToMine = async () => {
    "use server";
    await setViewMode("me");
  };
  return (
    <Card className="space-y-3">
      <p className="font-medium">{isSelf ? `${name} is switched off for you.` : `${personName} doesn't use ${name}.`}</p>
      <p className="text-sm text-fg-muted">
        {isSelf
          ? "It's hidden from your menus and Today. Nothing was deleted."
          : `${personName} switched it off in their own settings, so there's nothing to show here.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {isSelf && partner ? (
          <form action={seePartner}>
            <button className="pressable rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg">See {partner.name}&apos;s {name.toLowerCase()}</button>
          </form>
        ) : null}
        {!isSelf ? (
          <form action={backToMine}>
            <button className="pressable rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg">Back to mine</button>
          </form>
        ) : null}
        {isSelf ? (
          <form action={turnOn}>
            <button className="pressable rounded-full bg-surface-2 px-4 py-2 text-sm font-medium">Turn it on for me</button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
