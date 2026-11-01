import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";
import { InstallPrompt } from "@/components/install-prompt";
import { ProfileSettingsForm } from "./profile-settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <>
      <PageHeader title="Settings" subtitle={session.email ?? undefined} />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-semibold">You</h2>
          <ProfileSettingsForm profile={session.profile} />
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/settings/household" className="rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
            <p className="font-medium">🏠 Household</p>
            <p className="mt-1 text-sm text-fg-muted">Members, invites, features on/off, AI key and limits.</p>
          </Link>
          <Link href="/settings/sharing" className="rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
            <p className="font-medium">🔐 Sharing</p>
            <p className="mt-1 text-sm text-fg-muted">Choose what your partner can see or edit, and who viewed it.</p>
          </Link>
          <Link href="/settings/notifications" className="rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
            <p className="font-medium">🔔 Notifications</p>
            <p className="mt-1 text-sm text-fg-muted">Turn on push for this device; choose reminders and quiet hours.</p>
          </Link>
          <Link href="/digest" className="rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
            <p className="font-medium">📬 Weekly summary</p>
            <p className="mt-1 text-sm text-fg-muted">AI recap of your week, every Sunday evening.</p>
          </Link>
          <Link href="/settings/privacy" className="rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
            <p className="font-medium">🔒 Privacy & data</p>
            <p className="mt-1 text-sm text-fg-muted">App lock, download your data, delete your account.</p>
          </Link>
          <Link href="/customize" className="rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
            <p className="font-medium">🧩 Home widgets</p>
            <p className="mt-1 text-sm text-fg-muted">Pick and arrange the quick-log widgets on Home.</p>
          </Link>
        </div>
        <InstallPrompt />
        <SignOutButton />
      </div>
    </>
  );
}
