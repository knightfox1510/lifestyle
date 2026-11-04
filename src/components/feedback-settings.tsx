"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { hapticsOn, playTick, setHapticsOn, setSoundOn, soundOn } from "@/lib/feedback-prefs";
import { useT } from "@/lib/i18n/client";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-2 shadow-[inset_0_0_0_1px_var(--border)]"}`}>
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] duration-200 ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Sound and vibration on logging, for this device. */
export function FeedbackSettings() {
  const t = useT();
  const [sound, setSound] = useState(false);
  const [buzz, setBuzz] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSound(soundOn());
      setBuzz(hapticsOn());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{t("Sound & vibration")}</h2>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{t("Soft tick when you log")}</span>
          <span className="block text-xs text-fg-muted">{t("A quiet two-note sound when something is saved. On this device only.")}</span>
        </span>
        <Switch
          on={sound}
          label={t("Soft tick when you log")}
          onChange={(v) => {
            setSound(v);
            setSoundOn(v);
            if (v) playTick("log");
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{t("Vibrate on logging")}</span>
          <span className="block text-xs text-fg-muted">{t("A light tap on Android phones that support it.")}</span>
        </span>
        <Switch
          on={buzz}
          label={t("Vibrate on logging")}
          onChange={(v) => {
            setBuzz(v);
            setHapticsOn(v);
            if (v) {
              try {
                navigator.vibrate?.([12, 40, 18]);
              } catch {
                /* ignore */
              }
            }
          }}
        />
      </div>
    </Card>
  );
}
