import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { tripPlanSchema } from "@/lib/ai/phase2-schemas";
import { buildAiContext } from "@/lib/ai/context";
import type { Trip, TripItem } from "@/lib/types";

/** Long AI jobs (documents, photos, whole-week plans) can take a while: up to 5 minutes on Vercel. */
export const maxDuration = 300;

const body = z.object({ tripId: z.uuid(), notes: z.string().trim().max(600).optional(), useMedicalHistory: z.boolean().optional() });

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("travel")) throw new AiError("Travel is turned off.", 403);
    const input = body.parse(await request.json());
    const { data: t } = await session.supabase.from("trips").select("*").eq("id", input.tripId).eq("household_id", session.household.id).maybeSingle();
    if (!t) throw new AiError("Trip not found.", 404);
    const trip = t as Trip;
    const { data: it } = await session.supabase.from("trip_items").select("*").eq("trip_id", trip.id);
    const items = (it ?? []) as TripItem[];
    const ctx = await buildAiContext(session, { subjectId: session.userId, useMedicalHistory: input.useMedicalHistory, brief: true });

    const prompt = `Plan this trip for ${session.members.map((m) => m.display_name).join(" and ")}.
Trip: ${trip.title}${trip.destination ? ` to ${trip.destination}` : ""}${trip.start_date ? `, ${trip.start_date} to ${trip.end_date ?? "?"}` : " (dates not fixed: plan ~5 days with date null)"}.
${trip.budget ? `Budget: ${trip.currency} ${trip.budget}.` : ""}
Already saved: ${items.map((i) => `${i.kind}: ${i.title}${i.day_date ? ` (${i.day_date})` : ""}`).join("; ") || "nothing yet"}.
${input.notes ? `Wishes: ${input.notes}` : ""}

Give a realistic day-by-day plan (don't overpack days; include travel time and rest), a packing list tailored to destination, season and their health needs (medicines, comfort items, incontinence supplies if relevant), and practical tips (visas, transport passes, local etiquette, food for their diet).`;

    return runJson(session, {
      feature: "trip_plan", maxDuration,
      schema: tripPlanSchema,
      parts: [{ text: prompt }],
      system: `You are a careful travel planner. Respect health data quietly; never mention private conditions in a way others reading the plan would notice.\n\n${ctx.text}`,
      usedHealth: ctx.usedMedical,
      temperature: 0.7,
    });
  });
}
