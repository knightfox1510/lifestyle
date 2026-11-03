"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { FxBadge, FxStamp } from "@/components/feedback-fx";
import { KIND_META, inferDetail, inferKind, type FeedbackKind } from "@/lib/feedback-kind";

type Toast = { id: number; message: string; tone: "ok" | "error"; kind: FeedbackKind; detail: string | null; ms: number; undo?: () => void | Promise<unknown> };
export type ToastOptions = {
  undo?: Toast["undo"];
  tone?: Toast["tone"];
  /** What was done (food, water, dose…), for a fitting animation. Worked out from the message if left out. */
  kind?: FeedbackKind;
  /** A number to show off, e.g. "+420 kcal". Taken from the message if left out. */
  detail?: string | null;
  /** The big centre animation: on by default for real logs (food, water, doses, weigh-ins…). */
  stamp?: boolean;
};
type Stamp = { id: number; kind: FeedbackKind; label: string; detail: string | null };
type Ctx = {
  toast: (message: string, opts?: ToastOptions) => void;
  /** Only the centre animation (for screens that confirm in their own way, like the quick-log sheet). */
  stamp: (kind: FeedbackKind, label: string, detail?: string | null) => void;
};

const ToastCtx = createContext<Ctx>({ toast: () => {}, stamp: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

/** A light tap on phones that support it (Android); silently ignored elsewhere. */
export function haptic(ms: number | number[] = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

/** Bottom toasts (above the tab bar) confirming each log, with Undo where possible. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [items, setItems] = useState<Toast[]>([]);
  const [stampNow, setStampNow] = useState<Stamp | null>(null);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const stamp = useCallback<Ctx["stamp"]>((kind, label, detail = null) => {
    const id = ++seq.current;
    setStampNow({ id, kind, label, detail });
    setTimeout(() => setStampNow((s) => (s?.id === id ? null : s)), 1300);
  }, []);
  const toast = useCallback<Ctx["toast"]>(
    (message, opts) => {
      const id = ++seq.current;
      const tone = opts?.tone ?? "ok";
      const kind = opts?.kind ?? inferKind(message);
      const detail = opts?.detail === undefined ? inferDetail(message) : opts.detail;
      const ms = opts?.undo ? 5000 : 3000;
      setItems((xs) => [...xs.slice(-2), { id, message, tone, kind, detail, ms, undo: opts?.undo }]);
      if (tone === "ok") {
        haptic(KIND_META[kind].stamp ? [12, 40, 18] : 10);
        if (opts?.stamp ?? KIND_META[kind].stamp) stamp(kind, message, detail);
      } else haptic([30, 60, 30]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss, stamp],
  );
  return (
    <ToastCtx.Provider value={{ toast, stamp }}>
      {children}
      {stampNow ? <FxStamp key={stampNow.id} kind={stampNow.kind} label={stampNow.label} detail={stampNow.detail} /> : null}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+86px)] z-50 flex flex-col items-center gap-2 md:bottom-6">
        {items.map((x) => (
          <div
            key={x.id}
            role="status"
            className="pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-2xl bg-fg px-3.5 py-2.5 text-[14px] font-medium text-bg shadow-lg [animation:toast-in_.22s_ease-out]"
          >
            <FxBadge kind={x.kind} error={x.tone === "error"} />
            <span className="min-w-0 flex-1">{x.message}</span>
            {x.detail && x.tone === "ok" && !x.message.includes(x.detail.replace(/^\+/, "")) ? (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums [animation:fx-float_.6s_ease-out_both]" style={{ background: KIND_META[x.kind].color, color: "white" }}>{x.detail}</span>
            ) : null}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left opacity-40" style={{ background: x.tone === "error" ? "var(--danger)" : KIND_META[x.kind].color, animation: `fx-timer ${x.ms}ms linear forwards` }} />
            {x.undo ? (
              <button
                className="shrink-0 underline underline-offset-2"
                onClick={async () => {
                  dismiss(x.id);
                  await x.undo?.();
                  toast(t("Undone"));
                }}
              >
                {t("Undo")}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
