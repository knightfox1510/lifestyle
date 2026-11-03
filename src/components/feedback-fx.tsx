"use client";

import type { CSSProperties } from "react";
import { Activity, Droplet, Dumbbell, Package, Pill, RotateCcw, Scale, ShoppingCart, Sparkles, Sun, Trash2, Utensils, X, type LucideIcon } from "lucide-react";
import { KIND_META, type FeedbackKind } from "@/lib/feedback-kind";

/** Each kind's icon and the motion that fits it (a bite, a falling drop, a pill dropping in, a lift…). */
const FX: Record<FeedbackKind, { Icon: LucideIcon | null; motion: string }> = {
  food: { Icon: Utensils, motion: "fx-bite .6s cubic-bezier(.3,1.4,.5,1)" },
  water: { Icon: Droplet, motion: "fx-drop .55s ease-out" },
  dose: { Icon: Pill, motion: "fx-spin-in .6s cubic-bezier(.3,1.3,.5,1)" },
  body: { Icon: Scale, motion: "fx-squish .55s ease-out" },
  workout: { Icon: Dumbbell, motion: "fx-lift .7s ease-out" },
  checkin: { Icon: Sun, motion: "fx-rise .6s ease-out" },
  bladder: { Icon: Activity, motion: "fx-squish .5s ease-out" },
  cart: { Icon: ShoppingCart, motion: "fx-slide .5s ease-out" },
  pantry: { Icon: Package, motion: "fx-squish .5s ease-out" },
  habit: { Icon: null, motion: "" },
  ai: { Icon: Sparkles, motion: "fx-twinkle .6s ease-out" },
  delete: { Icon: Trash2, motion: "fx-shake .5s ease-in-out" },
  undo: { Icon: RotateCcw, motion: "fx-spin-in .5s ease-out" },
  save: { Icon: null, motion: "" },
};

/** A check mark that draws itself. */
function DrawnCheck({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: "fx-draw .45s .12s ease-out forwards" }} />
    </svg>
  );
}

/** The round coloured badge with the kind's animated icon (an error gets a plain cross). */
export function FxBadge({ kind, error = false, size = 30 }: { kind: FeedbackKind; error?: boolean; size?: number }) {
  const color = error ? "var(--danger)" : KIND_META[kind].color;
  const { Icon, motion } = FX[kind];
  const icon = Math.round(size * 0.52);
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full text-white" style={{ width: size, height: size, background: color }} aria-hidden>
      {!error ? <span className="absolute inset-0 rounded-full motion-reduce:hidden" style={{ background: color, animation: "fx-ring .7s ease-out forwards" }} /> : null}
      <span className="relative grid place-items-center" style={{ animation: error ? "fx-shake .45s ease-in-out" : motion || undefined }}>
        {error ? <X size={icon} strokeWidth={2.6} /> : Icon ? <Icon size={icon} strokeWidth={2.4} /> : <DrawnCheck size={icon + 2} />}
      </span>
    </span>
  );
}

/**
 * The big moment for a real log (food, water, a dose, a weigh-in, a
 * workout…): the badge pops in the middle of the screen with a small burst,
 * then fades. It doesn't block taps and is skipped with reduced motion.
 */
export function FxStamp({ kind, label, detail }: { kind: FeedbackKind; label: string; detail: string | null }) {
  const color = KIND_META[kind].color;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[34%] z-[60] flex flex-col items-center motion-reduce:hidden" style={{ animation: "fx-stamp 1.25s ease-out forwards" }}>
      <div className="relative">
        {Array.from({ length: 10 }, (_, i) => (
          <i
            key={i}
            className="absolute block size-2 rounded-full"
            style={{ left: "50%", top: "50%", margin: "-4px 0 0 -4px", background: i % 2 ? color : "var(--sun)", ["--a" as string]: `${i * 36}deg`, animation: `fx-particle .75s ${0.08 + (i % 3) * 0.03}s ease-out both` } as CSSProperties}
          />
        ))}
        <div className="rounded-full p-2" style={{ background: `color-mix(in oklab, ${color} 18%, var(--bg))`, boxShadow: "0 10px 40px rgba(0,0,0,.18)" }}>
          <FxBadge kind={kind} size={72} />
        </div>
      </div>
      <p className="mt-3 max-w-[80vw] truncate rounded-full bg-fg/90 px-3 py-1 text-[13px] font-medium text-bg">{label}</p>
      {detail ? (
        <p className="mt-1.5 text-[22px] font-semibold tabular-nums" style={{ color, animation: "fx-float 1.1s ease-out forwards" }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}
