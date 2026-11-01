import { NextResponse } from "next/server";
import { z } from "zod";
import { createPartFromBase64 } from "@google/genai";
import { getSession } from "@/lib/session";
import { AiError, DEFAULT_MODEL, assertQuota, getGemini, recordUsage } from "@/lib/ai/gemini";
import { medicalExtractionSchema, toGeminiSchema } from "@/lib/ai/schemas";
import type { MedicalDocument } from "@/lib/types";

const bodySchema = z.object({ documentId: z.uuid() });

const PROMPT = `You are reading a patient's medical document (hospital paper, discharge summary, prescription, lab report or similar).
Extract a faithful summary and timeline entries. Only include facts that are written in the document; never guess diagnoses.
Dates must be YYYY-MM-DD. Medications: one entry per drug with dosage and frequency as written; mark ongoing=true if prescribed without an end date.
If text is illegible, say so in the summary and skip that item.`;

export async function POST(request: Request) {
  const session = await getSession();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: doc } = await session.supabase
    .from("medical_documents")
    .select("*")
    .eq("id", parsed.data.documentId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const document = doc as MedicalDocument;
  if (session.accessTo("medical_records", document.owner_id) !== "write") {
    return NextResponse.json({ error: "You can only analyse documents you can edit" }, { status: 403 });
  }

  try {
    await assertQuota(session);
    const file = await session.supabase.storage.from("medical-documents").download(document.storage_path);
    if (file.error || !file.data) throw new AiError("Couldn't read the uploaded file", 404);
    const base64 = Buffer.from(await file.data.arrayBuffer()).toString("base64");

    const ai = await getGemini(session);
    const res = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: "user", parts: [createPartFromBase64(base64, document.mime_type), { text: PROMPT }] }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(medicalExtractionSchema),
        temperature: 0,
      },
    });
    await recordUsage(session, "medical_extract", false, res.usageMetadata);

    const extraction = medicalExtractionSchema.safeParse(JSON.parse(res.text ?? "{}"));
    if (!extraction.success) throw new AiError("The AI response couldn't be read. Try again.", 502);

    const { summary, document_date, provider, events } = extraction.data;
    await session.supabase
      .from("medical_documents")
      .update({
        ai_summary: summary,
        ai_extracted: extraction.data,
        ai_processed_at: new Date().toISOString(),
        document_date: document.document_date ?? document_date,
        provider: document.provider ?? provider,
      })
      .eq("id", document.id);

    return NextResponse.json({ summary, events });
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("medical extract failed", err);
    return NextResponse.json({ error: "Analysis failed. Try again in a moment." }, { status: 502 });
  }
}
