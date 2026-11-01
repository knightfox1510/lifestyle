import { getSession } from "@/lib/session";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { MODULES } from "@/modules/registry";
import { InviteCreator } from "./invite-creator";
import { AiSettings, RenameHousehold } from "./forms";
import Link from "next/link";
import { leaveHousehold, removeMember, revokeInvite, setModuleEnabled, switchHousehold } from "../actions";

export const metadata = { title: "Household" };

export default async function HouseholdSettingsPage() {
  const session = await getSession();
  const isOwner = session.me.role === "owner";
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { data: memberships } = await session.supabase.from("household_members").select("household_id, role").eq("user_id", session.userId);
  const { data: myHouseholds } = await session.supabase.from("households").select("id, name").in("id", (memberships ?? []).map((m: { household_id: string }) => m.household_id));
  const [{ data: invites }, { count: usedToday }] = await Promise.all([
    session.supabase
      .from("invites")
      .select("id, code, expires_at")
      .eq("household_id", session.household.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    session.supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("household_id", session.household.id)
      .gte("created_at", start.toISOString()),
  ]);

  const enabled = new Map(session.modules.map((m) => [m.module_key, m.enabled]));
  const groups = [...new Set(MODULES.map((m) => m.group))];

  return (
    <>
      <PageHeader title="Household" subtitle={session.household.name} />
      <div className="space-y-4">
        {isOwner ? (
          <Card>
            <RenameHousehold name={session.household.name} />
          </Card>
        ) : null}

        <Card className="space-y-3">
          <h2 className="font-semibold">Members</h2>
          <ul className="divide-y divide-border">
            {session.members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {m.display_name} {m.user_id === session.userId ? <span className="text-fg-muted">(you)</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>
                  {isOwner && m.user_id !== session.userId ? (
                    <form action={removeMember.bind(null, m.user_id)}>
                      <button className={buttonClass("danger", "sm")}>Remove</button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <InviteCreator />
          {invites && invites.length ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Open invites</p>
              {invites.map((i: { id: string; code: string; expires_at: string }) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono tracking-widest">{i.code}</span>
                  <span className="flex items-center gap-2 text-xs text-fg-muted">
                    expires {new Date(i.expires_at).toLocaleDateString("en-IN")}
                    <form action={revokeInvite.bind(null, i.id)}>
                      <button className="text-danger hover:underline">Revoke</button>
                    </form>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">Features</h2>
            <p className="text-sm text-fg-muted">Turn features on or off for everyone in this household.</p>
          </div>
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">{g}</p>
              <ul className="divide-y divide-border">
                {MODULES.filter((m) => m.group === g).map((m) => {
                  const on = m.status === "available" && (enabled.get(m.key) ?? false);
                  return (
                    <li key={m.key} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          <span aria-hidden>{m.icon}</span> {m.name} {m.sensitive ? <Badge>private by default</Badge> : null}
                        </p>
                        <p className="text-xs text-fg-muted">{m.description}</p>
                      </div>
                      {m.status === "available" ? (
                        <form action={setModuleEnabled.bind(null, m.key, !on)}>
                          <button
                            role="switch"
                            aria-checked={on}
                            aria-label={`${m.name} ${on ? "on" : "off"}`}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-border"}`}
                          >
                            <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                          </button>
                        </form>
                      ) : (
                        <Badge>Phase {m.phase}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Card>

        <Card>
          <AiSettings
            isOwner={isOwner}
            hasCustomKey={session.household.has_custom_ai_key}
            limit={session.household.ai_daily_limit}
            usedToday={usedToday ?? 0}
          />
        </Card>

        <Card className="space-y-2">
          <h2 className="font-semibold">Your households</h2>
          <ul className="divide-y divide-border text-sm">
            {(myHouseholds ?? []).map((h: { id: string; name: string }) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                <span>{h.name}</span>
                {h.id === session.household.id ? (
                  <Badge tone="accent">current</Badge>
                ) : (
                  <form action={switchHousehold.bind(null, h.id)}>
                    <button className={buttonClass("secondary", "sm")}>Switch</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <Link href="/onboarding?new=1" className="text-sm text-accent hover:underline">+ Create or join another household (e.g. your parents&apos;)</Link>
        </Card>

        <form action={leaveHousehold}>
          <button className={buttonClass("danger")}>Leave household</button>
          <p className="mt-1 text-xs text-fg-muted">Your records stay yours; sharing with other members ends.</p>
        </form>
      </div>
    </>
  );
}
