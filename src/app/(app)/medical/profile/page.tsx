import { getSession } from "@/lib/session";
import { Card, EmptyState } from "@/components/ui";
import type { MedicalProfile } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Health profile" };

export default async function HealthProfilePage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("medical_records", ownerId) === "write";
  const { data } = await session.supabase.from("medical_profiles").select("*").eq("owner_id", ownerId).maybeSingle();
  const profile = data as MedicalProfile | null;

  if (!profile && ownerId !== session.userId) {
    return <EmptyState title={`${session.subject.display_name} hasn't filled in a health profile yet`} />;
  }

  return (
    <Card>
      <ProfileForm ownerId={ownerId} profile={profile} readOnly={!canWrite} />
    </Card>
  );
}
