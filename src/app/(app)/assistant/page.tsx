import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { Assistant } from "./assistant";

export const metadata = { title: "Ask AI" };

export default async function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  const session = await getSession();
  const { q } = await searchParams;
  const people = session.members
    .filter((m) => session.accessTo("medical_records", m.user_id) !== "none" || m.user_id === session.userId)
    .map((m) => ({
      id: m.user_id,
      name: m.user_id === session.userId ? `${m.display_name} (me)` : m.display_name,
      medicalShared: session.accessTo("medical_records", m.user_id) !== "none",
    }));

  return (
    <>
      <PageHeader
        title="Ask AI"
        subtitle="Meal ideas, workout tweaks, routines. Answers take the person's medical history into account unless you switch it off."
      />
      <Assistant
        people={people}
        defaultSubject={session.subject.user_id}
        defaultUseMedical={session.profile.ai_use_medical_history}
        medicalEnabled={session.isModuleEnabled("medical_records")}
        defaultPrompt={typeof q === "string" ? q.slice(0, 4000) : ""}
      />
    </>
  );
}
