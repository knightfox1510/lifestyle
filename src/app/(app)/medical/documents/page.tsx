import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import { DOC_TYPE_LABEL, formatDate } from "@/modules/medical/meta";
import type { MedicalDocument } from "@/lib/types";
import { UploadDocument } from "./upload-document";
import { AnalyzeDocument } from "./analyze-document";
import { deleteMedicalDocument, setDocumentIncludeInAi, updateMedicalDocument } from "../actions";
import { EditRecord } from "@/components/edit-record";
import { DOC_TYPES } from "@/lib/types";

export const metadata = { title: "Papers & reports" };

export default async function DocumentsPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("medical_records", ownerId) === "write";
  const isOwner = ownerId === session.userId;

  const { data } = await session.supabase
    .from("medical_documents")
    .select("*")
    .eq("owner_id", ownerId)
    .order("document_date", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  const docs = (data ?? []) as MedicalDocument[];

  return (
    <div className="space-y-5">
      {canWrite ? <UploadDocument ownerId={ownerId} /> : null}

      {docs.length === 0 ? (
        <EmptyState title="No papers yet">
          Upload blood work, check-ups, discharge summaries, prescriptions, scans or ECGs (PDF or photo). AI reads them, adds lab values to Blood work and builds the timeline for you.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {docs.map((d) => (
            <li key={d.id} id={d.id} className="scroll-mt-24">
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-fg-muted">
                      {[DOC_TYPE_LABEL[d.doc_type], formatDate(d.document_date), d.provider].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {d.ai_processed_at ? <Badge tone="accent">AI read</Badge> : null}
                    {!d.include_in_ai ? <Badge>hidden from AI</Badge> : null}
                  </div>
                </div>
                {d.notes ? <p className="whitespace-pre-line text-sm text-fg-muted">{d.notes}</p> : null}
                {d.ai_summary ? (
                  <div className="rounded-xl bg-surface-2 p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">AI summary</p>
                    {d.ai_summary}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/medical/documents/${d.id}/open`} target="_blank" rel="noopener" className={buttonClass("secondary", "sm")}>
                    Open file
                  </a>
                  {canWrite ? <AnalyzeDocument documentId={d.id} alreadyRead={Boolean(d.ai_processed_at)} /> : null}
                  {canWrite ? (
                    <form action={setDocumentIncludeInAi.bind(null, d.id, ownerId, !d.include_in_ai)}>
                      <button className={buttonClass("ghost", "sm")}>{d.include_in_ai ? "Hide from AI" : "Use in AI"}</button>
                    </form>
                  ) : null}
                  {canWrite ? (
                    <EditRecord
                      iconOnly={false}
                      label="Edit details"
                      fields={[
                        { name: "title", label: "Title", type: "text", maxLength: 200 },
                        { name: "doc_type", label: "Type", type: "select", options: DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] })) },
                        { name: "document_date", label: "Date", type: "date" },
                        { name: "provider", label: "Hospital / doctor / lab", type: "text", maxLength: 200 },
                        { name: "notes", label: "Notes", type: "textarea", maxLength: 4000 },
                      ]}
                      values={{ title: d.title, doc_type: d.doc_type, document_date: d.document_date, provider: d.provider, notes: d.notes }}
                      onSave={updateMedicalDocument.bind(null, d.id, ownerId)}
                    />
                  ) : null}
                  {isOwner ? (
                    <form action={deleteMedicalDocument.bind(null, d.id)}>
                      <button className={buttonClass("danger", "sm")}>Delete</button>
                    </form>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
