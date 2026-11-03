import { getSession } from "@/lib/session";
import { coachSourcesFor } from "@/lib/coach";
import { COACH_SOURCES } from "@/modules/coach/facts";
import { CoachClient, type CoachReport } from "./coach-client";

export const metadata = { title: "AI coach" };

export default async function CoachPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const available = coachSourcesFor(session, ownerId);
  const { data } = await session.supabase
    .from("coach_reports")
    .select("id, created_at, goal, question, period_days, included, facts, result, applied_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(12);
  return (
    <CoachClient
      key={ownerId}
      storageKey={`coach:${session.userId}:${ownerId}`}
      sources={COACH_SOURCES.filter((s) => available.includes(s.key)).map((s) => ({ key: s.key, label: s.label }))}
      reports={(data ?? []) as CoachReport[]}
      canApply={session.isModuleEnabled("food_diary") && session.accessTo("food_diary", ownerId) === "write"}
      person={ownerId === session.userId ? null : session.subject.display_name}
    />
  );
}
