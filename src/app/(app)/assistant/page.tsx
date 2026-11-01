import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { Assistant } from "./assistant";

export const metadata = { title: "Ask AI" };

export default async function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  const session = await getSession();
  const { q } = await searchParams;
  // A partner's suggestions only use the data they've shared with you.
  const people = session.members.map((m) => ({
    id: m.user_id,
    name: m.user_id === session.userId ? `${m.display_name} (me)` : `${m.display_name} (uses what they share)`,
  }));

  return (
    <>
      <PageHeader
        title="Ask AI"
        subtitle="Meal ideas, workout tweaks, routines. Answers take health data (medical history, medicines, diaries, check-ins) into account unless you switch it off."
      />
      <Assistant
        people={people}
        defaultSubject={session.subject.user_id}
        defaultUseMedical={session.profile.ai_use_medical_history}
        defaultPrompt={typeof q === "string" ? q.slice(0, 4000) : ""}
      />
    </>
  );
}
