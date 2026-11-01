"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "hearth.install.dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Offers "Install app" (Android/desktop) or Add-to-Home-Screen steps (iOS, needed for notifications). */
export function InstallPrompt({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone || (compact && readDismissed())) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Deferred so the state update happens after mount, not during the effect body.
    const t = window.setTimeout(() => {
      if (isIos) {
        setIos(true);
        setHidden(false);
      }
    }, 0);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(t);
    };
  }, [compact]);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 !py-3">
      <p className="text-sm">
        {ios ? (
          <>
            📲 Install Hearth: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>. Needed for reminders on iPhone.
          </>
        ) : (
          <>📲 Install Hearth on this device for quick access and offline use.</>
        )}
      </p>
      <div className="flex gap-2">
        {deferred ? (
          <Button
            size="sm"
            onClick={async () => {
              await deferred.prompt();
              setDeferred(null);
              setHidden(true);
            }}
          >
            Install
          </Button>
        ) : null}
        {compact ? (
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
