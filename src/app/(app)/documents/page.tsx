import { getSession } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { Badge, Card, EmptyState } from "@/components/ui";
import type { VaultDocument } from "@/lib/types";
import { formatDate } from "@/modules/medical/meta";
import { daysUntil } from "@/modules/pantry/match";
import { DOC_LABEL } from "./labels";
import { DocForm } from "./doc-form";
import { deleteDocument } from "./actions";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const session = await getSession();
  const today = todayIn(session.profile.timezone);
  const { data } = await session.supabase.from("documents").select("*").eq("household_id", session.household.id).order("expires_on", { ascending: true, nullsFirst: false });
  const docs = (data ?? []) as VaultDocument[];
  const names = Object.fromEntries(session.members.map((m) => [m.user_id, m.user_id === session.userId ? "you" : m.display_name]));

  return (
    <div className="space-y-4">
      <DocForm />
      {docs.length === 0 ? (
        <EmptyState title="No documents yet">Add passports, visas, insurance policies and warranties to get renewal reminders.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const left = daysUntil(d.expires_on, today);
            return (
              <li key={d.id}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-fg-muted">
                        {DOC_LABEL[d.doc_type]}
                        {d.holder ? ` · ${d.holder}` : ""}
                        {d.number_last4 ? ` · ••••${d.number_last4}` : ""}
                        {d.expires_on ? ` · expires ${formatDate(d.expires_on)}` : ""}
                        {d.scope === "household" ? " · household" : ` · ${names[d.owner_id] ?? ""}`}
                      </p>
                      {d.notes ? <p className="text-xs text-fg-muted">{d.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {left !== null ? (
                        <Badge tone={left < 0 ? "danger" : left <= d.remind_days_before ? "warn" : "neutral"}>
                          {left < 0 ? "expired" : left === 0 ? "expires today" : left > 365 ? `${Math.round(left / 365)}y left` : `${left}d left`}
                        </Badge>
                      ) : null}
                      {d.owner_id === session.userId || d.scope === "household" ? (
                        <form action={deleteDocument.bind(null, d.id)}>
                          <button className="px-1 text-xs text-fg-muted hover:text-danger" aria-label={`Delete ${d.title}`}>✕</button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
