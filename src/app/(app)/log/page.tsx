import { getSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { QuickLogBox } from "@/components/quick-log-box";

export const metadata = { title: "Quick log" };

export default async function QuickLogPage() {
  const session = await getSession();
  return (
    <>
      <PageHeader
        title="Quick log"
        subtitle={`Type or speak naturally. AI splits it into food, drinks, bladder diary and weight entries${session.subject.user_id !== session.userId ? ` for ${session.subject.display_name}` : ""}; you confirm before anything is saved.`}
      />
      <Card>
        <QuickLogBox ownerId={session.subject.user_id} />
      </Card>
    </>
  );
}
