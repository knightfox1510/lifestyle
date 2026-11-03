"use client";

import { PhotoButtons } from "@/components/photo-buttons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Checkbox, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { DOC_TYPE_LABEL } from "@/modules/medical/meta";
import { DOC_TYPES } from "@/lib/types";
import { createMedicalDocument } from "../actions";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

export function UploadDocument({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setError("Choose a file or take a photo.");
    if (file.size > MAX_BYTES) return setError("Files must be 20 MB or smaller.");
    if (!ACCEPT.split(",").includes(file.type)) return setError("Upload a PDF or a photo (JPG, PNG, WEBP, HEIC).");
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);

    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const upload = await supabase.storage.from("medical-documents").upload(path, file, { contentType: file.type });
    if (upload.error) {
      setBusy(false);
      return setError("Upload failed. Check your connection and try again.");
    }

    const res = await createMedicalDocument({
      ownerId,
      title: String(form.get("title") || file.name),
      doc_type: form.get("doc_type") as (typeof DOC_TYPES)[number],
      document_date: String(form.get("document_date") || ""),
      provider: String(form.get("provider") || ""),
      notes: String(form.get("notes") || ""),
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      include_in_ai: form.get("include_in_ai") === "on",
    });
    setBusy(false);
    if (res.error) {
      await supabase.storage.from("medical-documents").remove([path]);
      return setError(res.error);
    }
    setFile(null);
    setOpen(false);
    router.push(`/medical/documents#${res.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface"
      >
        + Upload a report: blood work, hospital papers, scans (PDF or photo)
      </button>
    );
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="File" hint="PDF or photo, up to 20 MB.">
          <div className="flex flex-wrap items-center gap-2">
            <PhotoButtons accept={ACCEPT} onFiles={(f) => setFile(f[0])} cameraLabel="Photograph paper" uploadLabel="Upload PDF or photo" />
            {file ? <span className="text-sm text-fg-muted">{file.name} <button type="button" className="underline" onClick={() => setFile(null)}>remove</button></span> : null}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <Input name="title" maxLength={200} placeholder="e.g. Annual blood work, Thyrocare" />
          </Field>
          <Field label="Type">
            <Select name="doc_type" defaultValue="lab_report">
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date on document">
            <Input type="date" name="document_date" />
          </Field>
          <Field label="Hospital / doctor">
            <Input name="provider" maxLength={200} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea name="notes" maxLength={4000} />
        </Field>
        <Checkbox name="include_in_ai" defaultChecked label="Use in AI suggestions" />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
