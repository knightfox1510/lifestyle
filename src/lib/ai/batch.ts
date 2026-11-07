import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import type { AppSession } from "@/lib/session";
import { assertQuota, getGemini, prepareRequest, recordUsage } from "@/lib/ai/gemini";

/**
 * Google's batch mode: half price, but the answer comes back within hours
 * rather than seconds. Used for work nobody is waiting on (the Sunday AI
 * summary, the monthly new-season check). A job is submitted on one reminder
 * run and collected on a later one (they run every few minutes).
 */
export type BatchDone = { text: string; response: GenerateContentResponse };
export type Notice = { kind: string; refKey: string; title: string; body: string; url: string };

/** Submits one request as a batch job and remembers it. Returns false if it couldn't be submitted. */
export async function submitBatch(admin: SupabaseClient, session: AppSession, feature: string, request: Omit<GenerateContentParameters, "model">, payload: Record<string, unknown>, opts: { usedHealth?: boolean } = {}) {
  await assertQuota(session, feature);
  const ai = await getGemini(session);
  const prep = prepareRequest(session, request, { feature });
  const model = prep.models[0];
  const job = await ai.batches.create({
    model,
    src: [{ contents: request.contents, config: prep.configFor(model) }],
    config: { displayName: `hearth-${feature}-${session.userId.slice(0, 8)}` },
  });
  if (!job.name) return false;
  const { error } = await admin.from("ai_batches").insert({ household_id: session.household.id, user_id: session.userId, feature, job_name: job.name, model, payload: { ...payload, usedHealth: Boolean(opts.usedHealth) } });
  return !error;
}

type Row = { id: string; user_id: string; feature: string; job_name: string; model: string; payload: Record<string, unknown>; created_at: string };

/**
 * Checks this person's waiting jobs. Finished ones are handed to `onDone`
 * (which saves the result and may return a notification); failed or very
 * late ones (8 h+) go to `onFail` for a fallback.
 */
export async function collectBatches(
  admin: SupabaseClient,
  session: AppSession,
  handlers: Record<string, { onDone: (done: BatchDone, payload: Record<string, unknown>) => Promise<Notice | null>; onFail: (payload: Record<string, unknown>) => Promise<Notice | null> }>,
): Promise<Notice[]> {
  const { data, error } = await admin.from("ai_batches").select("id, user_id, feature, job_name, model, payload, created_at").eq("user_id", session.userId).eq("status", "pending");
  if (error || !data?.length) return [];
  const ai = await getGemini(session);
  const out: Notice[] = [];
  for (const row of data as Row[]) {
    const h = handlers[row.feature];
    if (!h) continue;
    const finish = (status: "done" | "failed") => admin.from("ai_batches").update({ status, finished_at: new Date().toISOString() }).eq("id", row.id);
    try {
      const job = await ai.batches.get({ name: row.job_name });
      // The Gemini API has used both JOB_STATE_* and BATCH_STATE_* names.
      const state = String(job.state ?? "").replace(/^BATCH_STATE_/, "JOB_STATE_");
      if (state === "JOB_STATE_SUCCEEDED") {
        const response = job.dest?.inlinedResponses?.[0]?.response;
        // Read the parts directly: a batch response may be a plain object without the SDK's `.text` getter.
        const text = (response?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
        if (response && text) {
          await recordUsage(session, row.feature, Boolean(row.payload.usedHealth), { usageMetadata: response.usageMetadata, modelUsed: row.model, candidates: response.candidates }, { batch: true });
          const n = await h.onDone({ text, response }, row.payload);
          if (n) out.push(n);
          await finish("done");
          continue;
        }
      }
      const late = Date.now() - Date.parse(row.created_at) > 8 * 3600_000;
      if (state === "JOB_STATE_SUCCEEDED" || state === "JOB_STATE_FAILED" || state === "JOB_STATE_CANCELLED" || state === "JOB_STATE_EXPIRED" || late) {
        if (late && !["JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"].includes(state)) await ai.batches.cancel({ name: row.job_name }).catch(() => {});
        const n = await h.onFail(row.payload);
        if (n) out.push(n);
        await finish("failed");
      }
    } catch (err) {
      console.warn("batch check failed", row.job_name, (err as Error).message);
    }
  }
  return out;
}
