import { getSession } from "@/lib/session";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { AppLockSettings } from "@/components/app-lock";
import { DeleteAccountForm } from "./delete-form";

export const metadata = { title: "Privacy & data" };

export default async function PrivacyPage() {
  const session = await getSession();
  const others = session.members.filter((m) => m.user_id !== session.userId);
  const { data: errRows } = await session.supabase.from("app_errors").select("id, created_at, source, path, message").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(10);
  const errors = (errRows ?? []) as { id: number; created_at: string; source: string; path: string | null; message: string }[];
  return (
    <>
      <PageHeader title="Privacy & data" subtitle="Lock the app on this device, download everything, or delete your account." />
      <div className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-semibold">🔒 App lock (this device)</h2>
          <p className="text-sm text-fg-muted">
            Ask for your fingerprint, face or device PIN (or a Hearth PIN) when the app opens or after it has been in the background. Useful on a shared phone or laptop. It keeps others from opening the app on this device; your data is already protected on the server by your sign-in.
          </p>
          <AppLockSettings />
        </Card>

        <Card className="space-y-2">
          <h2 className="font-semibold">⬇️ Download my data</h2>
          <p className="text-sm text-fg-muted">A JSON file with everything you&apos;ve recorded, your household&apos;s shared lists, and 24-hour download links for your uploaded medical files.</p>
          <a href="/api/export" className={buttonClass("secondary")}>Download export</a>
        </Card>

        <Card className="space-y-2">
          <h2 className="font-semibold">🛠️ Problems the app ran into</h2>
          <p className="text-sm text-fg-muted">When something breaks on your devices, a short note is kept (the error message, the page and the time; never what you logged) so it can be found and fixed. The last 10:</p>
          {errors.length ? (
            <ul className="divide-y divide-border text-sm">
              {errors.map((e) => (
                <li key={e.id} className="py-1.5">
                  <span className="text-fg-muted">{new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {e.path ?? "?"} · {e.source}</span>
                  <span className="block truncate font-mono text-[12px]">{e.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">✓ None recently.</p>
          )}
        </Card>

        <Card className="space-y-3 border-danger/40">
          <h2 className="font-semibold text-danger">Delete my account</h2>
          <p className="text-sm text-fg-muted">
            Permanently deletes your profile, all your personal records (medical, diaries, food, body, documents…), uploaded files and gift ideas.
            {others.length
              ? ` Shared household lists stay with ${others.map((o) => o.display_name).join(" and ")}${session.me.role === "owner" ? ", who becomes the household owner" : ""}.`
              : " Your household and its shared lists are deleted too."}{" "}
            This can&apos;t be undone. Download your data first if you want a copy.
          </p>
          <DeleteAccountForm />
        </Card>
      </div>
    </>
  );
}
