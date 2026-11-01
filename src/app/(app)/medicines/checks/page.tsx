import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card, EmptyState, Notice } from "@/components/ui";
import { medicineChecksFor } from "@/lib/medicine-checks";
import { getT } from "@/lib/i18n/server";
import { AiMedicineCheck } from "./ai-check";
import { FindingCard } from "./finding-card";

export const metadata = { title: "Medicine safety checks" };

export default async function MedicineChecksPage() {
  const session = await getSession();
  const t = await getT(session);
  const ownerId = session.subject.user_id;
  const { list, findings, unknown, allergies } = await medicineChecksFor(session, ownerId);

  if (!list.length) {
    return (
      <EmptyState title={t("Nothing to check yet")}>
        <Link href="/medicines/manage" className="text-accent underline">{t("Add medicines")}</Link> {t("and supplements, and Hearth will check them against each other.")}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <Notice>
        {t("These checks look for duplicate ingredients, known interactions and timing clashes between {n} medicines and supplements. They are a safety net, not medical advice — never stop or change a prescribed medicine without talking to your doctor or pharmacist.", { n: list.length })}
      </Notice>
      {findings.length === 0 ? (
        <Card>
          <p className="font-medium">✓ {t("No problems found by the built-in checks.")}</p>
          <p className="mt-1 text-sm text-fg-muted">{t("Use the AI review below for a second look that also considers your conditions and blood work.")}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {findings.map((f) => (
            <li key={f.id}>
              <FindingCard f={f} t={t} />
            </li>
          ))}
        </ul>
      )}
      {unknown.length ? (
        <p className="text-xs text-fg-muted">
          {t("Not recognised by the built-in checks (the AI review still looks at them):")} {unknown.join(", ")}
        </p>
      ) : null}
      {allergies.length ? <p className="text-xs text-fg-muted">{t("Allergies checked:")} {allergies.join("; ")}</p> : null}
      <AiMedicineCheck subjectId={ownerId} />
    </div>
  );
}
