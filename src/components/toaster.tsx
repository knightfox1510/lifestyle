"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";

type Toast = { id: number; message: string; tone: "ok" | "error"; undo?: () => void | Promise<unknown> };
type Ctx = { toast: (message: string, opts?: { undo?: Toast["undo"]; tone?: Toast["tone"] }) => void };

const ToastCtx = createContext<Ctx>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

/** A light tap on phones that support it (Android); silently ignored elsewhere. */
export function haptic(ms = 10) {
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
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback<Ctx["toast"]>(
    (message, opts) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, message, tone: opts?.tone ?? "ok", undo: opts?.undo }]);
      if ((opts?.tone ?? "ok") === "ok") haptic();
      setTimeout(() => dismiss(id), opts?.undo ? 5000 : 3000);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+86px)] z-50 flex flex-col items-center gap-2 md:bottom-6">
        {items.map((x) => (
          <div
            key={x.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-fg px-4 py-3 text-[14px] font-medium text-bg shadow-lg [animation:toast-in_.22s_ease-out]"
          >
            {x.tone === "ok" ? <Check className="size-4 shrink-0" aria-hidden /> : <X className="size-4 shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1">{x.message}</span>
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
