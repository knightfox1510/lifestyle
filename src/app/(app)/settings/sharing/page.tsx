import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { SHARE_NAME, SHARE_ONLY, SHAREABLE_MODULES } from "@/modules/registry";
import { ShareSelect } from "./share-select";

export const metadata = { title: "Sharing" };

export default async function SharingPage() {
  const session = await getSession();
  const others = session.members.filter((m) => m.user_id !== session.userId);
  const nameOf = (id: string) => session.members.find((m) => m.user_id === id)?.display_name ?? "Former member";

  const { data: log } = await session.supabase
    .from("share_access_log")
    .select("viewer_id, module_key, viewed_at")
    .eq("owner_id", session.userId)
    .order("viewed_at", { ascending: false })
    .limit(20);

  const given = (granteeId: string, moduleKey: string) =>
    session.shares.find((s) => s.owner_id === session.userId && s.grantee_id === granteeId && s.module_key === moduleKey)
      ?.level ?? "none";
  const received = session.shares.filter((s) => s.grantee_id === session.userId);

  return (
    <>
      <PageHeader
        title="Sharing"
        subtitle="Your personal data is private until you share it. Household items (groceries, home maintenance…) are always visible to all members."
      />
      {others.length === 0 ? (
        <EmptyState title="No one to share with yet">Invite your partner from Settings → Household.</EmptyState>
      ) : (
        <div className="space-y-4">
          {others.map((p) => (
            <Card key={p.user_id}>
              <h2 className="mb-1 font-semibold">What {p.display_name} can see</h2>
              <p className="mb-3 text-sm text-fg-muted">“Can edit” lets them add entries for you (e.g. log a medicine they gave you). Only you can delete.</p>
              <ul className="divide-y divide-border">
                {SHAREABLE_MODULES.map((m) => (
                  <li key={m.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span aria-hidden>{m.icon}</span> {m.name}{" "}
                        {m.status === "planned" ? <Badge>coming soon</Badge> : null}
                        {m.sensitive ? <Badge tone="warn">sensitive</Badge> : null}
                      </p>
                    </div>
                    <ShareSelect granteeId={p.user_id} moduleKey={m.key} value={given(p.user_id, m.key)} />
                  </li>
                ))}
                {SHARE_ONLY.map((m) => (
                  <li key={m.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium"><span aria-hidden>{m.icon}</span> {m.name}</p>
                      <p className="text-xs text-fg-muted">{m.description}</p>
                    </div>
                    <ShareSelect granteeId={p.user_id} moduleKey={m.key} value={given(p.user_id, m.key)} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          <Card>
            <h2 className="mb-2 font-semibold">Shared with you</h2>
            {received.length ? (
              <ul className="space-y-1 text-sm">
                {received.map((s) => (
                  <li key={`${s.owner_id}-${s.module_key}`}>
                    {nameOf(s.owner_id)}: {SHARE_NAME[s.module_key] ?? s.module_key}{" "}
                    <Badge tone="accent">{s.level === "write" ? "can edit" : "view"}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">Nothing yet.</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Recent views of your data</h2>
            {log && log.length ? (
              <ul className="space-y-1 text-sm">
                {log.map((l: { viewer_id: string; module_key: string; viewed_at: string }, i: number) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      {nameOf(l.viewer_id)} viewed {SHARE_NAME[l.module_key] ?? l.module_key}
                    </span>
                    <span className="text-fg-muted">{new Date(l.viewed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">No one has viewed your shared data.</p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
