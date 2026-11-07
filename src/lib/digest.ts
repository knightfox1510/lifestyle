import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AppSession } from "@/lib/session";
import { AiError, assertQuota, generate, recordUsage } from "@/lib/ai/gemini";
import { SAFETY_INSTRUCTIONS, buildAiContext } from "@/lib/ai/context";
import { addDays, dayOfWeek, todayIn } from "@/lib/dates";
import { loadDays, waterSettings } from "@/lib/today";
import { dayScore } from "@/modules/engagement/rings";
import { plainDigest } from "@/modules/engagement/plain-digest";

export function weekStart(today: string) {
  return addDays(today, -((dayOfWeek(today) + 6) % 7));
}

/** Household items coming up next week (shared rows only). */
async function householdUpcoming(session: AppSession, today: string) {
  const db = session.supabase;
  const hid = session.household.id;
  const until = addDays(today, 14);
  const on = (k: string) => session.isModuleEnabled(k);
  const [pantry, maint, subs, docs, vacc] = await Promise.all([
    on("pantry") ? db.from("pantry_items").select("name, expires_on").eq("household_id", hid).is("used_up_at", null).lte("expires_on", addDays(today, 4)) : null,
    on("maintenance") ? db.from("maintenance_tasks").select("title, next_due_on").eq("household_id", hid).lte("next_due_on", until) : null,
    on("subscriptions") ? db.from("subscriptions").select("name, next_renewal_on, cost, currency").eq("household_id", hid).eq("active", true).lte("next_renewal_on", until) : null,
    on("documents") ? db.from("documents").select("title, expires_on, owner_id, scope").eq("household_id", hid).lte("expires_on", addDays(today, 90)) : null,
    on("child") ? db.from("vaccinations").select("vaccine, due_on").eq("household_id", hid).is("given_on", null).lte("due_on", until) : null,
  ]);
  const visibleDocs = ((docs?.data ?? []) as { title: string; expires_on: string; owner_id: string; scope: string }[]).filter(
    (d) => d.scope === "household" || d.owner_id === session.userId,
  );
  return [
    pantry?.data?.length ? `Expiring food: ${pantry.data.map((p: { name: string }) => p.name).join(", ")}.` : null,
    maint?.data?.length ? `Home maintenance due: ${maint.data.map((m: { title: string; next_due_on: string }) => `${m.title} (${m.next_due_on})`).join(", ")}.` : null,
    subs?.data?.length ? `Subscriptions renewing: ${subs.data.map((s: { name: string; next_renewal_on: string }) => `${s.name} (${s.next_renewal_on})`).join(", ")}.` : null,
    visibleDocs.length ? `Documents expiring within 90 days: ${visibleDocs.map((d) => `${d.title} (${d.expires_on})`).join(", ")}.` : null,
    vacc?.data?.length ? `Child vaccinations due: ${vacc.data.map((v: { vaccine: string; due_on: string }) => `${v.vaccine} (${v.due_on})`).join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Everything a week's summary is built from: the week's goals and score, what
 * the household has coming up, and (for the AI version) the request to send.
 */
export async function digestInputs(session: AppSession, opts: { ai: boolean }) {
  const today = todayIn(session.profile.timezone);
  const ws = weekStart(today);
  const shown = (m: string) => session.isShown(m);
  const water = await waterSettings(session.supabase, session.userId);
  const [ctx, upcoming, days] = await Promise.all([
    opts.ai ? buildAiContext(session, { subjectId: session.userId, useMedicalHistory: session.profile.ai_use_medical_history, brief: true }) : Promise.resolve(null),
    householdUpcoming(session, today),
    loadDays(session.supabase, session.userId, { tz: session.profile.timezone, today, days: 14, enabled: { medicines: shown("medicines"), food: shown("food_diary"), checkin: shown("checkin"), supplements: shown("supplements") }, waterTarget: water.target, supplementTimes: session.profile.supplement_times }),
  ]);
  const plain = () => plainDigest(days.statuses.slice(-7), days.statuses.slice(-14, -7), upcoming ? upcoming.split("\n") : []);
  if (!ctx) return { ws, plain, request: null, usedHealth: false };
  // The same score as the Health page, so the text and the screen agree.
  const scores = (list: typeof days.statuses) => list.filter((d) => d.rings.length).map((d) => ({ date: d.date, score: dayScore(d.rings) }));
  const thisWeek = scores(days.statuses.slice(-7));
  const lastWeek = scores(days.statuses.slice(-14, -7));
  const avg = (xs: { score: number }[]) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.score, 0) / xs.length) : null);
  const best = [...thisWeek].sort((a, b) => b.score - a.score)[0];
  const notes = days.statuses.slice(-7).filter((d) => d.note).map((d) => `${d.date}: ${d.note}`);
  const scoreLine = (notes.length ? `Day notes (context for low or unusual days): ${notes.join("; ")}.\n` : "") + (avg(thisWeek) != null ? `Health score this week: ${avg(thisWeek)}/100${avg(lastWeek) != null ? ` (last week ${avg(lastWeek)})` : ""}; days with every goal done: ${days.statuses.slice(-7).filter((d) => d.closed).length}/7${best ? `; best day ${best.date} (${best.score}%)` : ""}.` : "");
  const request = {
    contents: `Write ${session.me.display_name}'s weekly summary for the week starting ${ws}. Use only the data provided.
Format (plain text, no markdown headings, max ~180 words):
🌟 Wins: 2–3 short bullets (adherence, trends improving, workouts, habits).
👀 Watch: 1–3 bullets on patterns worth attention (e.g. leaks after caffeine, missed doses, low protein, out-of-range labs), kind and non-alarming.
📅 Coming up: household items due in the next two weeks.
💡 One small, specific suggestion for next week.
If there is little data, say so briefly and suggest one thing to start tracking.

Start the first line with the health score if given (e.g. "Score 68, up 7 on last week").
${scoreLine}

Household items:
${upcoming || "(none)"}`,
    config: { systemInstruction: `${SAFETY_INSTRUCTIONS}\n\n${ctx.text}`, temperature: 0.5 },
  };
  return { ws, plain, request, usedHealth: ctx.usedMedical };
}

export async function saveDigest(userId: string, ws: string, content: string) {
  const { error } = await createAdminClient()
    .from("digests")
    .upsert({ user_id: userId, week_start: ws, content, created_at: new Date().toISOString() }, { onConflict: "user_id,week_start" });
  if (error) throw new AiError("Couldn't save the summary.", 500);
}

/**
 * Writes (or rewrites) this week's summary. Without AI (the default) it's
 * built from the week's numbers: free and instant. With AI it's written by
 * Gemini from the same numbers plus a brief health context.
 */
export async function generateDigest(session: AppSession, opts: { ai?: boolean } = {}): Promise<{ content: string; weekStart: string }> {
  const input = await digestInputs(session, { ai: Boolean(opts.ai) });
  if (!input.request) {
    const content = input.plain();
    await saveDigest(session.userId, input.ws, content);
    return { content, weekStart: input.ws };
  }
  await assertQuota(session, "weekly_digest");
  const res = await generate(session, input.request, { feature: "weekly_digest" });
  await recordUsage(session, "weekly_digest", input.usedHealth, res);
  const content = (res.text ?? "").trim();
  if (!content) throw new AiError("The AI returned an empty summary.", 502);
  await saveDigest(session.userId, input.ws, content);
  return { content, weekStart: input.ws };
}
