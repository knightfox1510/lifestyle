"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { cx } from "@/components/ui";
import { useSpeechLang } from "@/lib/i18n/client";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/** Mic button using the browser's speech recognition (Chrome/Edge/Safari). Hidden where unsupported. */
export function VoiceButton({ onText, lang }: { onText: (text: string) => void; lang?: string }) {
  const appLang = useSpeechLang();
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  // Server render says "unsupported"; the browser value is read after hydration.
  const supported = useSyncExternalStore(
    () => () => {},
    () => Boolean((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition),
    () => false,
  );
  if (!supported) return null;

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    const r = new Ctor();
    r.lang = lang ?? appLang;
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      if (text) onText(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop listening" : "Speak"}
      title={listening ? "Stop listening" : "Speak"}
      className={cx(
        "flex size-10 shrink-0 items-center justify-center rounded-xl border text-lg",
        listening ? "animate-pulse border-danger bg-danger-soft" : "border-border hover:bg-surface-2",
      )}
    >
      🎙️
    </button>
  );
}
