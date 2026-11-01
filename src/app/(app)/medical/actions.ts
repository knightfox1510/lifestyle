"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { extractedEventSchema } from "@/lib/ai/schemas";
import { labResultSchema } from "@/lib/ai/phase2-schemas";
import { computeFlag } from "@/modules/medical/labs";
import { DOC_TYPES, MEDICAL_CATEGORIES, SEVERITIES, type ActionResult } from "@/lib/types";

const MODULE = "medical_records";
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const optionalDate = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Invalid date")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

async function requireWrite(ownerId: string) {
  const session = await getSession();
  if (!session.isModuleEnabled(MODULE)) throw new Error("Medical records are turned off for this household");
  if (session.accessTo(MODULE, ownerId) !== "write") throw new Error("You don't have permission to change these records");
  return session;
}

function refresh() {
  revalidatePath("/medical", "layout");
  revalidatePath("/");
}

// ---------------------------------------------------------------- events ----

const eventSchema = z
  .object({
    ownerId: z.uuid(),
    category: z.enum(MEDICAL_CATEGORIES),
    title: z.string().trim().min(1, "Add a title").max(200),
    details: optionalText(4000),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    end_date: optionalDate,
    ongoing: z.coerce.boolean().optional().default(false),
    severity: z.enum(SEVERITIES).or(z.literal("")).transform((v) => (v === "" ? null : v)).optional(),
    dosage: optionalText(120),
    frequency: optionalText(120),
    related_event_id: z.uuid().or(z.literal("")).transform((v) => (v === "" ? null : v)).optional(),
    include_in_ai: z.coerce.boolean().optional().default(false),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { message: "End date is before start date" });

export async function addMedicalEvent(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(form);
  const parsed = eventSchema.safeParse({ ...raw, ongoing: raw.ongoing === "on", include_in_ai: raw.include_in_ai === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;

  try {
    const session = await requireWrite(ownerId);
    const isMedication = values.category === "medication";
    const { error } = await session.supabase.from("medical_events").insert({
      ...values,
      end_date: values.ongoing ? null : values.end_date,
      dosage: isMedication ? values.dosage : null,
      frequency: isMedication ? values.frequency : null,
      owner_id: ownerId,
      created_by: session.userId,
      household_id: session.household.id,
    });
    if (error) return { error: "Couldn't save the entry." };
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return { ok: true, message: "Added to the timeline." };
}

export async function setEventIncludeInAi(eventId: string, ownerId: string, include: boolean) {
  const session = await requireWrite(ownerId);
  await session.supabase.from("medical_events").update({ include_in_ai: include }).eq("id", eventId);
  refresh();
}

export async function endMedicalEvent(eventId: string, ownerId: string) {
  const session = await requireWrite(ownerId);
  const today = new Date().toISOString().slice(0, 10);
  await session.supabase.from("medical_events").update({ ongoing: false, end_date: today }).eq("id", eventId);
  refresh();
}

export async function deleteMedicalEvent(eventId: string) {
  const session = await getSession();
  // RLS lets only the owner delete; this is a no-op for anyone else.
  await session.supabase.from("medical_events").delete().eq("id", eventId).eq("owner_id", session.userId);
  refresh();
}

// --------------------------------------------------------------- profile ----

const profileSchema = z.object({
  ownerId: z.uuid(),
  date_of_birth: optionalDate,
  sex: z.enum(["female", "male", "other"]).or(z.literal("")).transform((v) => (v === "" ? null : v)),
  blood_group: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  height_cm: z
    .string()
    .transform((v) => (v.trim() === "" ? null : Number(v)))
    .refine((v) => v === null || (v >= 30 && v <= 260), "Height must be between 30 and 260 cm"),
  notes: optionalText(4000),
  include_in_ai: z.boolean(),
});

export async function saveMedicalProfile(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(form);
  const parsed = profileSchema.safeParse({ ...raw, include_in_ai: raw.include_in_ai === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(ownerId);
    const { data: existing } = await session.supabase
      .from("medical_profiles")
      .select("owner_id")
      .eq("owner_id", ownerId)
      .maybeSingle();
    const { error } = existing
      ? await session.supabase.from("medical_profiles").update(values).eq("owner_id", ownerId)
      : ownerId === session.userId
        ? await session.supabase.from("medical_profiles").insert({ ...values, owner_id: ownerId })
        : { error: { message: "Only they can create their profile" } };
    if (error) return { error: error.message === "Only they can create their profile" ? error.message : "Couldn't save." };
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return { ok: true, message: "Saved." };
}

// ------------------------------------------------------------- documents ----

const documentSchema = z.object({
  ownerId: z.uuid(),
  title: z.string().trim().min(1, "Add a title").max(200),
  doc_type: z.enum(DOC_TYPES),
  document_date: optionalDate,
  provider: optionalText(200),
  notes: optionalText(4000),
  storage_path: z.string().min(1).max(300),
  mime_type: z.string().min(1).max(100),
  size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
  include_in_ai: z.boolean(),
});

/** Called after the browser uploaded the file to Storage. */
export async function createMedicalDocument(input: z.input<typeof documentSchema>): Promise<ActionResult & { id?: string }> {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  if (!values.storage_path.startsWith(`${ownerId}/`)) return { error: "Invalid upload path" };
  try {
    const session = await requireWrite(ownerId);
    const { data, error } = await session.supabase
      .from("medical_documents")
      .insert({ ...values, owner_id: ownerId, created_by: session.userId, household_id: session.household.id })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't save the document." };
    refresh();
    return { ok: true, id: data.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setDocumentIncludeInAi(documentId: string, ownerId: string, include: boolean) {
  const session = await requireWrite(ownerId);
  await session.supabase.from("medical_documents").update({ include_in_ai: include }).eq("id", documentId);
  refresh();
}

export async function deleteMedicalDocument(documentId: string) {
  const session = await getSession();
  const { data } = await session.supabase
    .from("medical_documents")
    .select("storage_path, owner_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!data || data.owner_id !== session.userId) return;
  await session.supabase.storage.from("medical-documents").remove([data.storage_path]);
  await session.supabase.from("medical_documents").delete().eq("id", documentId);
  refresh();
}

/** Saves the AI-proposed timeline entries and lab values the user ticked. */
export async function importExtractedEvents(documentId: string, events: unknown, labs: unknown = []): Promise<ActionResult> {
  const parsed = z.array(extractedEventSchema).max(100).safeParse(events);
  const parsedLabs = z.array(labResultSchema).max(200).safeParse(labs);
  if (!parsed.success || !parsedLabs.success) return { error: "Some entries are invalid. Check dates (YYYY-MM-DD)." };
  if (parsed.data.length === 0 && parsedLabs.data.length === 0) return { error: "Select at least one entry." };

  const session = await getSession();
  const { data: doc } = await session.supabase
    .from("medical_documents")
    .select("owner_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };
  if (session.accessTo(MODULE, doc.owner_id) !== "write") return { error: "You can't edit these records." };

  const rows = parsed.data.map((e) => ({
    ...e,
    end_date: e.ongoing ? null : e.end_date && e.end_date < e.start_date ? null : e.end_date,
    owner_id: doc.owner_id,
    created_by: session.userId,
    household_id: session.household.id,
    document_id: documentId,
    source: "ai_extracted" as const,
    include_in_ai: true,
  }));
  if (rows.length) {
    const { error } = await session.supabase.from("medical_events").insert(rows);
    if (error) return { error: "Couldn't add the entries." };
  }
  if (parsedLabs.data.length) {
    const { error } = await session.supabase.from("lab_results").insert(
      parsedLabs.data.map((l) => ({
        ...l,
        flag: l.flag ?? computeFlag(l.value, l.ref_low, l.ref_high),
        owner_id: doc.owner_id,
        created_by: session.userId,
        household_id: session.household.id,
        document_id: documentId,
        source: "ai_extracted" as const,
      })),
    );
    if (error) return { error: "Couldn't add the lab results." };
  }
  refresh();
  const parts = [
    rows.length ? `${rows.length} timeline ${rows.length === 1 ? "entry" : "entries"}` : null,
    parsedLabs.data.length ? `${parsedLabs.data.length} lab value${parsedLabs.data.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return { ok: true, message: `Added ${parts.join(" and ")}.` };
}

// ------------------------------------------------------------ lab results ----

const num = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().nullable());
const labSchema = z
  .object({
    ownerId: z.uuid(),
    test_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the test date"),
    panel: optionalText(100),
    marker: z.string().trim().min(1, "Which test?").max(120),
    value: num,
    value_text: optionalText(120),
    unit: optionalText(40),
    ref_low: num,
    ref_high: num,
  })
  .refine((v) => v.value !== null || v.value_text, { message: "Enter a value" });

export async function addLabResult(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = labSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(ownerId);
    const { error } = await session.supabase.from("lab_results").insert({
      ...values,
      flag: computeFlag(values.value ?? null, values.ref_low ?? null, values.ref_high ?? null),
      owner_id: ownerId,
      created_by: session.userId,
      household_id: session.household.id,
    });
    if (error) return { error: "Couldn't save the result." };
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return { ok: true, message: "Result added." };
}

export async function setLabIncludeInAi(id: string, ownerId: string, include: boolean) {
  const session = await requireWrite(ownerId);
  await session.supabase.from("lab_results").update({ include_in_ai: include }).eq("id", id);
  refresh();
}

export async function deleteLabResult(id: string) {
  const session = await getSession();
  await session.supabase.from("lab_results").delete().eq("id", id).eq("owner_id", session.userId);
  refresh();
}
