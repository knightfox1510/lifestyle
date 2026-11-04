"use client";

import { useState, useTransition } from "react";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { PillIcon } from "@/components/pill-icon";
import { PILL_COLORS, PILL_HEX, PILL_SHAPES, SHAPE_LABEL, type PillColor, type PillShape } from "@/modules/medicines/look";
import { setPillLook } from "@/lib/pill-actions";

/** Tap the pill to set how it looks: shape and colour, saved as you pick. */
export function PillLookPicker({ kind, id, ownerId, shape, color, canEdit }: { kind: "medicine" | "supplement"; id: string; ownerId: string; shape: string | null; color: string | null; canEdit: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [look, setLook] = useState<{ shape: PillShape | null; color: PillColor | null }>({ shape: shape as PillShape | null, color: color as PillColor | null });
  const [, start] = useTransition();
  const save = (next: typeof look) => {
    const before = look;
    setLook(next);
    start(async () => {
      const r = await setPillLook({ kind, id, ownerId, ...next });
      if (r.error) {
        setLook(before);
        toast(r.error, { tone: "error" });
      }
    });
  };
  const icon = <PillIcon shape={look.shape} color={look.color} size={30} />;
  if (!canEdit) return <span className="shrink-0">{icon}</span>;
  return (
    <span className="relative shrink-0">
      <button type="button" onClick={() => setOpen(!open)} className="pressable grid place-items-center rounded-xl p-0.5 hover:bg-surface-2" aria-label="Set how it looks" aria-expanded={open} title="How it looks">
        {icon}
        {!look.shape && !look.color ? <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-fg">+</span> : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 space-y-2 rounded-2xl bg-surface p-3 shadow-[0_0_0_1px_var(--border),0_12px_32px_-12px_rgb(0_0_0/0.35)] [animation:toast-in_.18s_ease-out]">
          <p className="text-xs font-medium text-fg-muted">Shape</p>
          <div className="grid grid-cols-5 gap-1">
            {PILL_SHAPES.map((s) => (
              <button key={s} type="button" title={SHAPE_LABEL[s]} aria-label={SHAPE_LABEL[s]} aria-pressed={look.shape === s} onClick={() => save({ ...look, shape: s })} className={cx("grid place-items-center rounded-lg p-1", look.shape === s ? "bg-accent-soft ring-1 ring-accent" : "hover:bg-surface-2")}>
                <PillIcon shape={s} color={look.color} size={26} />
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-fg-muted">Colour</p>
          <div className="flex flex-wrap gap-1.5">
            {PILL_COLORS.map((c) => (
              <button key={c} type="button" title={c} aria-label={c} aria-pressed={look.color === c} onClick={() => save({ ...look, color: c })} className={cx("size-6 rounded-full ring-1 ring-black/15", look.color === c && "ring-2 ring-accent ring-offset-2 ring-offset-surface")} style={{ background: PILL_HEX[c] }} />
            ))}
          </div>
          <div className="flex justify-between pt-1 text-xs">
            <button type="button" className="text-fg-muted underline" onClick={() => save({ shape: null, color: null })}>Clear</button>
            <button type="button" className="font-medium text-accent" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
