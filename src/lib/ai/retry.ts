/** Model choice, error classification and retry/fallback for Gemini (pure; unit-tested). */

export type AiModelChoice = "standard" | "best";

/** Google's auto-updating aliases: always the current Flash / Pro / Flash-Lite. */
export const MODELS = { standard: "gemini-flash-latest", best: "gemini-pro-latest", lite: "gemini-flash-lite-latest" } as const;

/** The models to try in order: the household's choice (or GEMINI_MODEL), then a lighter fallback. */
export function modelChain(choice: AiModelChoice | null | undefined, override?: string | null): string[] {
  const primary = override?.trim() || MODELS[choice === "best" ? "best" : "standard"];
  const fallback = primary === MODELS.best ? MODELS.standard : primary === MODELS.lite ? MODELS.standard : MODELS.lite;
  return [...new Set([primary, fallback])];
}

export type AiFailure = "quota" | "busy" | "key" | "safety" | "bad_request" | "empty" | "unknown";

/** Turns a Gemini SDK error into a kind; only quota/busy/empty/unknown are worth retrying. */
export function classifyAiError(err: unknown): { kind: AiFailure; retry: boolean; status: number | null } {
  const e = err as { status?: number; code?: number; message?: string; name?: string };
  const status = typeof e?.status === "number" ? e.status : typeof e?.code === "number" ? e.code : null;
  const msg = String(e?.message ?? "").toLowerCase();
  if (e?.name === "EmptyResponse") return { kind: "empty", retry: true, status };
  if (status === 429 || msg.includes("resource_exhausted") || msg.includes("quota")) return { kind: "quota", retry: true, status };
  if (status === 401 || status === 403 || msg.includes("api key not valid") || msg.includes("permission_denied")) return { kind: "key", retry: false, status };
  if (msg.includes("safety") || msg.includes("blocked")) return { kind: "safety", retry: false, status };
  if (status === 500 || status === 502 || status === 503 || status === 504 || msg.includes("unavailable") || msg.includes("overloaded") || msg.includes("deadline")) return { kind: "busy", retry: true, status };
  if (status === 404 || status === 400 || msg.includes("invalid_argument") || msg.includes("not found")) return { kind: "bad_request", retry: status === 404, status };
  return { kind: "unknown", retry: true, status };
}

export const FAILURE_MESSAGE: Record<AiFailure, string> = {
  quota: "Google's free limit for this AI key is used up for now. Try again in a minute, or add your own key in Settings → Household.",
  busy: "Gemini is busy right now (we tried twice). Try again in a minute.",
  key: "The Gemini key isn't valid. Check it in Settings → Household (or GEMINI_API_KEY in Vercel).",
  safety: "The AI declined this request. Try rewording it.",
  bad_request: "The AI couldn't process this request. Try a smaller photo or shorter text.",
  empty: "The AI returned an empty answer. Try again.",
  unknown: "The AI request failed. Try again in a moment.",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls `attempt(model)` with retries: each model gets up to two tries
 * (short backoff) on retryable failures, then the next model in the chain.
 * Non-retryable failures stop immediately.
 */
export async function withRetry<T>(models: string[], attempt: (model: string) => Promise<T>, opts: { delays?: number[] } = {}) {
  const delays = opts.delays ?? [800, 2000];
  let last: unknown = null;
  for (const model of models) {
    for (let i = 0; i < 2; i++) {
      try {
        return { result: await attempt(model), model };
      } catch (err) {
        last = err;
        const c = classifyAiError(err);
        console.error(`gemini ${model} attempt ${i + 1} failed: ${c.kind} (${c.status ?? "-"})`, (err as Error)?.message?.slice(0, 300));
        if (!c.retry) throw err;
        // A model that doesn't exist (404) won't recover: go straight to the next one.
        if (c.kind === "bad_request") break;
        await sleep(delays[Math.min(i, delays.length - 1)] * (models.indexOf(model) + 1));
      }
    }
  }
  throw last;
}
