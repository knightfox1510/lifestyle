"use client";

import { useEffect } from "react";

/** Errors that a fresh page load fixes: a new version was deployed while the page was open. */
export function isStaleDeployError(error: unknown) {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return msg.includes("failed to find server action") || (msg.includes("server action") && msg.includes("not found")) || msg.includes("chunkloaderror") || msg.includes("loading chunk") || msg.includes("failed to fetch dynamically imported module");
}

/** Reload once (per page) when the error came from an outdated version of the app. */
function useAutoRecover(error: unknown) {
  useEffect(() => {
    console.error(error);
    if (!isStaleDeployError(error)) return;
    try {
      const key = `hearth:auto-reload:${location.pathname}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    location.reload();
  }, [error]);
}

const digestOf = (error: unknown) => (error && typeof error === "object" && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "");

/** In-app error screen (styled with the app's tokens). */
export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  useAutoRecover(error);
  const digest = digestOf(error);
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center" role="alert">
      <p className="text-[22px] font-semibold tracking-[-0.03em]">Something went wrong</p>
      <p className="text-sm text-fg-muted">
        {isStaleDeployError(error) ? "Hearth was just updated. Reloading usually fixes this." : "This screen hit a problem. Try again, or reload the app."}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button className="pressable h-11 rounded-full bg-fg px-5 text-[15px] font-medium text-bg" onClick={() => retry()}>Try again</button>
        <button className="pressable h-11 rounded-full bg-surface-2 px-5 text-[15px] font-medium" onClick={() => location.reload()}>Reload</button>
        {/* A full page load on purpose: it drops broken client state from an outdated version. */}
        {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
        <button className="pressable h-11 rounded-full px-5 text-[15px] text-fg-muted underline" onClick={() => location.assign("/")}>Home</button>
      </div>
      {digest ? <p className="mt-4 font-mono text-[12px] text-fg-muted">Reference: {digest}</p> : null}
    </div>
  );
}

/** Root-level fallback: renders its own document with inline styles (no app CSS here). */
export function GlobalErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  useAutoRecover(error);
  const digest = digestOf(error);
  const btn = { height: 44, padding: "0 20px", borderRadius: 999, border: 0, fontSize: 15, fontWeight: 500, cursor: "pointer" } as const;
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", background: "#fbfbfa", color: "#0d0d0c" }}>
        <main role="alert" style={{ maxWidth: 360, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Something went wrong</p>
          <p style={{ color: "#6e6d68", fontSize: 14 }}>
            {isStaleDeployError(error) ? "Hearth was just updated. Reloading usually fixes this." : "The app hit a problem. Try again, or reload."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
            <button style={{ ...btn, background: "#0d0d0c", color: "#fbfbfa" }} onClick={() => retry()}>Try again</button>
            <button style={{ ...btn, background: "#f3f3f1", color: "#0d0d0c" }} onClick={() => location.reload()}>Reload</button>
            {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
            <button style={{ ...btn, background: "transparent", color: "#6e6d68", textDecoration: "underline" }} onClick={() => location.assign("/")}>Home</button>
          </div>
          {digest ? <p style={{ marginTop: 24, fontFamily: "monospace", fontSize: 12, color: "#6e6d68" }}>Reference: {digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
