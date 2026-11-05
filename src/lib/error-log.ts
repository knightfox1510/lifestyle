import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const clip = (s: unknown, n: number) => (s == null ? null : String(s).slice(0, n));
/** Pages only: query strings can carry dates, names or ids. */
const pathOnly = (p: unknown) => (p == null ? null : String(p).split(/[?#]/)[0].slice(0, 300));

/** Saves one error (best effort: logging must never break the request). */
export async function logAppError(e: { source: "server" | "client"; userId?: string | null; path?: unknown; message: unknown; digest?: unknown; stack?: unknown; userAgent?: unknown }) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    await createAdminClient().from("app_errors").insert({
      source: e.source,
      user_id: e.userId ?? null,
      path: pathOnly(e.path),
      message: clip(e.message, 500) ?? "Unknown error",
      digest: clip(e.digest, 100),
      stack: clip(e.stack, 2000),
      user_agent: clip(e.userAgent, 300),
    });
  } catch {
    /* ignore */
  }
}
