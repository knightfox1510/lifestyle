"use client";

import { useEffect } from "react";

/** Sends an error from this browser to the app's error log (best effort, once per message per page view). */
const sent = new Set<string>();
export function reportError(error: unknown, extra?: { digest?: string }) {
  try {
    const e = error as { message?: string; stack?: string; digest?: string };
    const message = String(e?.message ?? error ?? "Unknown error");
    if (!message || sent.has(message) || sent.size > 20) return;
    sent.add(message);
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stack: e?.stack, digest: extra?.digest ?? e?.digest, path: location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

/** Catches errors nothing else handled (a failed script, an unhandled promise). */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Browser extensions and cross-origin scripts report "Script error." with no detail: skip those.
      if (!e.message || e.message === "Script error.") return;
      reportError(e.error ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const m = String((e.reason as { message?: string })?.message ?? e.reason ?? "");
      // Being offline isn't a bug (the offline queue handles it).
      if (/fetch|network|load failed/i.test(m)) return;
      reportError(e.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
