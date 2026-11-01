import { getSession } from "@/lib/session";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/modules/medical/meta";
import { GenerateButton } from "./generate-button";

export const metadata = { title: "Weekly summary" };

export default async function DigestPage() {
  const session = await getSession();
  const { data } = await session.supabase.from("digests").select("week_start, content, created_at").eq("user_id", session.userId).order("week_start", { ascending: false }).limit(12);
  const digests = (data ?? []) as { week_start: string; content: string; created_at: string }[];
  return (
    <>
      <PageHeader title="Weekly summary" subtitle="An AI recap of your week (health, habits, food, fitness) and what's coming up at home. Arrives Sunday evening if notifications are on." actions={<GenerateButton />} />
      {digests.length === 0 ? (
        <EmptyState title="No summaries yet">Generate one now, or turn on notifications to get it every Sunday.</EmptyState>
      ) : (
        <div className="space-y-3">
          {digests.map((d) => (
            <Card key={d.week_start}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Week of {formatDate(d.week_start)}</p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{d.content}</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
