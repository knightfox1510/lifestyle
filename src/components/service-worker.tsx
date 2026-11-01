"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Registers the offline service worker and, when a new version of the app
 * has been deployed, shows a banner to switch to it (so phones never stay
 * stuck on an old build). Also checks for updates whenever the app is reopened.
 */
export function ServiceWorker() {
  const t = useT();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | null = null;
    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const sw = r.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
        });
      });
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((r) => {
        reg = r;
        watch(r);
      })
      .catch(() => {
        /* non-fatal: app works without offline support */
      });
    const onVisible = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => {});
    };
    let reloading = false;
    const onController = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-fg px-4 py-3 text-[14px] text-bg shadow-lg [animation:toast-in_.25s_ease-out]">
      <span>{t("A new version of Hearth is ready.")}</span>
      <button className="shrink-0 rounded-full bg-bg px-3 py-1.5 text-[13px] font-medium text-fg" onClick={() => waiting.postMessage("SKIP_WAITING")}>
        {t("Reload")}
      </button>
    </div>
  );
}
