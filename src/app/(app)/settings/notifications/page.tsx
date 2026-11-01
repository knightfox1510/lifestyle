import { getSession } from "@/lib/session";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import type { NotificationPrefs } from "@/lib/types";
import { localTime } from "@/lib/dates";
import { PushToggle, PrefsForm } from "./client";
import { removeDevice } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await getSession();
  const [{ data: prefs }, { data: devices }, { data: log }, { data: goal }] = await Promise.all([
    session.supabase.from("notification_prefs").select("*").eq("user_id", session.userId).maybeSingle(),
    session.supabase.from("push_subscriptions").select("id, user_agent, created_at, last_success_at").eq("user_id", session.userId).order("created_at"),
    session.supabase.from("notification_log").select("title, body, sent_at, kind").eq("user_id", session.userId).order("sent_at", { ascending: false }).limit(15),
    session.supabase.from("nutrition_goals").select("water_ml").eq("owner_id", session.userId).maybeSingle(),
  ]);
  const tz = session.profile.timezone;

  return (
    <>
      <PageHeader title="Notifications" subtitle="Reminders for medicines, classes, expiring food, renewals, home maintenance, your child's vaccinations and a weekly summary." />
      <div className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-semibold">This device</h2>
          <PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
          {devices?.length ? (
            <ul className="divide-y divide-border text-sm">
              {devices.map((d: { id: string; user_agent: string | null; created_at: string; last_success_at: string | null }) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{(d.user_agent ?? "Device").replace(/\(.*?\)/g, "").slice(0, 60)}</span>
                    <span className="text-xs text-fg-muted">added {new Date(d.created_at).toLocaleDateString("en-IN")}{d.last_success_at ? ` · last delivered ${new Date(d.last_success_at).toLocaleDateString("en-IN")}` : ""}</span>
                  </span>
                  <form action={removeDevice.bind(null, d.id)}>
                    <button className={buttonClass("ghost", "sm")}>Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <PrefsForm prefs={prefs as NotificationPrefs | null} waterGoal={(goal as { water_ml: number | null } | null)?.water_ml ?? null} />
        </Card>

        {log?.length ? (
          <Card>
            <h2 className="mb-2 font-semibold">Recently sent</h2>
            <ul className="divide-y divide-border text-sm">
              {log.map((l: { title: string; body: string | null; sent_at: string }, i: number) => (
                <li key={i} className="py-1.5">
                  <span className="font-medium">{l.title}</span> {l.body ? <span className="text-fg-muted">· {l.body}</span> : null}
                  <span className="block text-xs text-fg-muted">{new Date(l.sent_at).toLocaleDateString("en-IN")} {localTime(l.sent_at, tz)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
