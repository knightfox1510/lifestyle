import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { todayIn } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { WhatsAppImporter } from "./importer";

export const metadata = { title: "Import leaks" };

export default async function BladderImportPage() {
  const session = await getSession();
  const t = await getT(session);
  const subject = session.subject;
  const tz = session.profile.timezone;
  if (session.accessTo("bladder_diary", subject.user_id) !== "write") {
    return (
      <EmptyState title={t("You can't add to {person}'s diary", { person: subject.display_name })}>
        {t("Ask them to share the bladder diary with edit access (Settings → Sharing), or let them import it from their own account.")}
      </EmptyState>
    );
  }
  return <WhatsAppImporter ownerId={subject.user_id} ownerName={subject.display_name} isSelf={subject.user_id === session.userId} tz={tz} today={todayIn(tz)} />;
}
