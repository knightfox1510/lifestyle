import type { Instrumentation } from "next";

/** Server errors (pages, actions, API routes) go to the app_errors table. */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logAppError } = await import("@/lib/error-log");
  const e = err as { message?: string; digest?: string; stack?: string };
  await logAppError({ source: "server", path: request.path, message: e?.message ?? String(err), digest: e?.digest, stack: e?.stack, userAgent: request.headers["user-agent"] });
};
