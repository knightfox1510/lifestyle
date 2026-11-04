"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72;

/**
 * Pull down at the top of the page to reload its data. Only in the installed
 * app: browser tabs already have their own pull-to-refresh.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [pending, start] = useTransition();
  const from = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const t = window.setTimeout(() => setEnabled(Boolean(standalone)), 0);
    if (!standalone) return () => window.clearTimeout(t);
    const down = (e: TouchEvent) => {
      from.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (from.current == null) return;
      const dy = e.touches[0].clientY - from.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) setPull((pullRef.current = 0));
        return;
      }
      // Resistance: the further you pull, the less it moves.
      const p = Math.min(120, dy * 0.5);
      pullRef.current = p;
      setPull(p);
    };
    const up = () => {
      if (from.current == null) return;
      from.current = null;
      if (pullRef.current >= THRESHOLD) {
        try {
          navigator.vibrate?.(10);
        } catch {
          /* ignore */
        }
        start(() => router.refresh());
      }
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [router]);

  const shown = pending ? THRESHOLD * 0.75 : pull;
  return (
    <>
      {enabled && (shown > 4 || pending) ? (
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+6px)] z-40 flex justify-center" style={{ transform: `translateY(${Math.min(shown, 90) - 36}px)`, transition: pull ? "none" : "transform .3s cubic-bezier(.3,1.3,.5,1)" }}>
          <span className="grid size-9 place-items-center rounded-full bg-surface shadow-[0_0_0_1px_var(--border),0_6px_18px_-6px_rgb(0_0_0/.3)]">
            <RefreshCw className={`size-4 text-accent ${pending ? "animate-spin" : ""}`} style={pending ? undefined : { transform: `rotate(${(pull / THRESHOLD) * 270}deg)`, opacity: Math.min(1, pull / THRESHOLD) }} aria-hidden />
            {pending ? <span className="sr-only">Refreshing</span> : null}
          </span>
        </div>
      ) : null}
      <div style={enabled && pull ? { transform: `translateY(${pull * 0.35}px)` } : undefined} className={pull ? "" : "transition-transform duration-300"}>{children}</div>
    </>
  );
}
