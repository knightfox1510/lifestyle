"use client";

import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cx } from "@/components/ui";

type Action = { label: string; icon?: ReactNode; onAction: () => void; tone?: "accent" | "danger" };

/**
 * Phones: swipe a row right to do its main thing (tick it off, mark used up,
 * edit), or left to reveal Delete. Only touch drags count, so mouse clicks
 * and vertical scrolling behave as usual.
 */
export function SwipeRow({ children, right, left, className, as: Tag = "li" }: { children: ReactNode; right?: Action; left?: Action; className?: string; as?: "li" | "div" }) {
  const [dx, setDx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const LEFT_W = 92;

  const down = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || (!right && !left)) return;
    start.current = { x: e.clientX, y: e.clientY, on: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const x = e.clientX - s.x;
    const y = e.clientY - s.y;
    if (!s.on && Math.abs(x) > 10 && Math.abs(x) > Math.abs(y) * 1.4) {
      s.on = true;
      setDragging(true);
    }
    if (s.on) setDx(Math.max(left ? -LEFT_W - 24 : 0, Math.min(right ? 120 : 0, x + (revealed ? -LEFT_W : 0))));
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s?.on) return;
    if (dx > 72 && right) {
      try {
        navigator.vibrate?.(10);
      } catch {
        /* ignore */
      }
      right.onAction();
      setDx(0);
      setRevealed(false);
    } else if (dx < -56 && left) {
      setDx(-LEFT_W);
      setRevealed(true);
    } else {
      setDx(0);
      setRevealed(false);
    }
  };
  const close = () => {
    setDx(0);
    setRevealed(false);
  };

  return (
    <Tag className={cx("relative overflow-hidden", className)}>
      {dx !== 0 ? (
        <div className="absolute inset-0 flex items-stretch justify-between">
          {right ? (
            <span className={cx("flex items-center gap-1.5 px-4 text-xs font-medium transition-opacity", right.tone === "danger" ? "text-danger" : "text-accent", dx > 36 ? "opacity-100" : "opacity-0")} aria-hidden>
              {right.icon} {right.label}
            </span>
          ) : <span />}
          {left ? (
            <button
              type="button"
              tabIndex={revealed ? 0 : -1}
              onClick={() => {
                left.onAction();
                close();
              }}
              className={cx("flex items-center gap-1.5 bg-danger px-4 text-xs font-medium text-white transition-opacity", dx < -30 ? "opacity-100" : "opacity-0")}
              style={{ width: LEFT_W }}
            >
              {left.icon ?? <Trash2 className="size-4" aria-hidden />} {left.label}
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className="relative touch-pan-y"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? "none" : "transform .22s cubic-bezier(.3,1.2,.5,1)" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          if (revealed) {
            e.stopPropagation();
            e.preventDefault();
            close();
          }
        }}
      >
        {children}
      </div>
    </Tag>
  );
}
