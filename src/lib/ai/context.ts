import "server-only";

import type { AppSession } from "@/lib/session";
import type { MedicalDocument, MedicalEvent, MedicalProfile } from "@/lib/types";
import { buildTrackingContext } from "@/lib/ai/tracking-context";

/**
 * Builds the personal context that every AI feature receives. Today this is
 * the medical record; later modules (food diary, bladder diary, supplements,
 * fitness...) add their own sections here so all suggestions see the full
 * picture.
 *
 * Overrides, from broadest to narrowest:
 *  1. profiles.ai_use_medical_history: the person's default
 *  2. `useMedicalHistory` per request (the switch on each AI screen)
 *  3. include_in_ai on each profile / event / document
 *
 * All reads go through the caller's RLS-bound client, so the AI can only see
 * a partner's records if the partner has shared them.
 */

const MAX_EVENTS = 200;
const MAX_DOCS = 40;
const MAX_CHARS = 24_000;

export type AiContext = {
  text: string;
  usedMedical: boolean;
  stats: { events: number; documents: number; profile: boolean };
};

function age(dob: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) years -= 1;
  return `${years}`;
}

function range(e: Pick<MedicalEvent, "start_date" | "end_date" | "ongoing">): string {
  if (e.ongoing) return `since ${e.start_date} (ongoing)`;
  if (e.end_date && e.end_date !== e.start_date) return `${e.start_date} → ${e.end_date}`;
  return e.start_date;
}

function isCurrentMedication(e: MedicalEvent, today: string) {
  return e.category === "medication" && (e.ongoing || (e.end_date !== null && e.end_date >= today));
}

function eventLine(e: MedicalEvent, byId: Map<string, MedicalEvent>): string {
  const parts = [`- [${e.category}] ${e.title} (${range(e)})`];
  if (e.severity) parts.push(`severity: ${e.severity}`);
  if (e.dosage || e.frequency) parts.push(`dose: ${[e.dosage, e.frequency].filter(Boolean).join(", ")}`);
  const rel = e.related_event_id ? byId.get(e.related_event_id) : undefined;
  if (rel) parts.push(`for: ${rel.title}`);
  if (e.details) parts.push(`notes: ${e.details.replace(/\s+/g, " ").slice(0, 300)}`);
  return parts.join(" · ");
}

export async function buildMedicalContext(
  session: AppSession,
  subjectId: string,
): Promise<Omit<AiContext, "usedMedical">> {
  const { supabase } = session;
  const [profileRes, eventsRes, docsRes] = await Promise.all([
    supabase.from("medical_profiles").select("*").eq("owner_id", subjectId).maybeSingle(),
    supabase
      .from("medical_events")
      .select("*")
      .eq("owner_id", subjectId)
      .eq("include_in_ai", true)
      .order("start_date", { ascending: false })
      .limit(MAX_EVENTS),
    supabase
      .from("medical_documents")
      .select("title, doc_type, document_date, provider, notes, ai_summary")
      .eq("owner_id", subjectId)
      .eq("include_in_ai", true)
      .order("document_date", { ascending: false, nullsFirst: false })
      .limit(MAX_DOCS),
  ]);

  const profile = profileRes.data as MedicalProfile | null;
  const events = (eventsRes.data ?? []) as MedicalEvent[];
  const docs = (docsRes.data ?? []) as Pick<
    MedicalDocument,
    "title" | "doc_type" | "document_date" | "provider" | "notes" | "ai_summary"
  >[];

  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map(events.map((e) => [e.id, e]));
  const lines: string[] = [];

  if (profile?.include_in_ai) {
    const facts = [
      profile.date_of_birth && `age ${age(profile.date_of_birth)}`,
      profile.sex && `sex ${profile.sex}`,
      profile.blood_group && `blood group ${profile.blood_group}`,
      profile.height_cm && `height ${profile.height_cm} cm`,
    ].filter(Boolean);
    if (facts.length) lines.push(`Basics: ${facts.join(", ")}.`);
    if (profile.notes) lines.push(`Personal health notes: ${profile.notes}`);
  }

  const allergies = events.filter((e) => e.category === "allergy");
  const conditions = events.filter((e) => e.category === "condition" && (e.ongoing || !e.end_date));
  const currentMeds = events.filter((e) => isCurrentMedication(e, today));

  if (allergies.length) {
    lines.push("", "ALLERGIES (must always be respected):", ...allergies.map((e) => eventLine(e, byId)));
  }
  if (conditions.length) {
    lines.push("", "Ongoing conditions:", ...conditions.map((e) => eventLine(e, byId)));
  }
  if (currentMeds.length) {
    lines.push("", "Current medications (check for interactions):", ...currentMeds.map((e) => eventLine(e, byId)));
  }

  const shown = new Set([...allergies, ...conditions, ...currentMeds].map((e) => e.id));
  const history = events.filter((e) => !shown.has(e.id));
  if (history.length) {
    lines.push("", "Medical timeline (newest first):", ...history.map((e) => eventLine(e, byId)));
  }

  const docLines = docs
    .map((d) => {
      const summary = d.ai_summary || d.notes;
      if (!summary) return null;
      const meta = [d.doc_type.replace("_", " "), d.document_date, d.provider].filter(Boolean).join(", ");
      return `- ${d.title} (${meta}): ${summary.replace(/\s+/g, " ").slice(0, 600)}`;
    })
    .filter(Boolean) as string[];
  if (docLines.length) {
    lines.push("", "Hospital papers & reports (summaries):", ...docLines);
  }

  let text = lines.join("\n").trim();
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}\n…(older history truncated)`;

  return {
    text,
    stats: { events: events.length, documents: docLines.length, profile: Boolean(profile?.include_in_ai) },
  };
}

/** Shared context for every AI feature. */
export async function buildAiContext(
  session: AppSession,
  opts: { subjectId: string; useMedicalHistory?: boolean },
): Promise<AiContext> {
  const subject = session.members.find((m) => m.user_id === opts.subjectId);
  const isSelf = opts.subjectId === session.userId;
  const useMedical = opts.useMedicalHistory ?? (isSelf ? session.profile.ai_use_medical_history : true);
  const header = [
    `Person: ${subject?.display_name ?? "household member"}${isSelf ? " (the user asking)" : " (the asker's partner)"}.`,
    `Timezone: ${session.profile.timezone}. Units: ${session.profile.units}. Today: ${new Date().toISOString().slice(0, 10)}.`,
  ].join("\n");

  const empty = { events: 0, documents: 0, profile: false };
  if (!useMedical) {
    return { text: `${header}\n\n(Health data not included for this request.)`, usedMedical: false, stats: empty };
  }

  const medicalAllowed = session.isModuleEnabled("medical_records") && session.accessTo("medical_records", opts.subjectId) !== "none";
  const [medical, tracking] = await Promise.all([
    medicalAllowed ? buildMedicalContext(session, opts.subjectId) : Promise.resolve({ text: "", stats: empty }),
    buildTrackingContext(session, opts.subjectId),
  ]);
  const sections = [
    medical.text ? `=== MEDICAL HISTORY ===\n${medical.text}` : "",
    tracking ? `=== RECENT HEALTH TRACKING ===\n${tracking}` : "",
  ].filter(Boolean);
  if (!sections.length) {
    return { text: `${header}\n\n(No health data recorded yet.)`, usedMedical: false, stats: medical.stats };
  }
  return { text: `${header}\n\n${sections.join("\n\n")}`, usedMedical: true, stats: medical.stats };
}

export const SAFETY_INSTRUCTIONS = `You are the household's lifestyle assistant (food, fitness, routines, groceries, wellbeing).
Rules:
- Use the person's medical history and recent health tracking below when relevant: respect allergies absolutely, avoid foods/exercises that conflict with conditions, recent surgeries or current medications, and mention briefly when a suggestion was adjusted because of their history.
- You are not a doctor. Do not diagnose or change prescriptions. For red-flag symptoms or medication questions, recommend contacting their doctor.
- Be concise and practical. Use metric units unless the person prefers imperial.`;
