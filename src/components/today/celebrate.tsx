"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { announceDayClosed } from "@/lib/engagement-actions";
import { useT } from "@/lib/i18n/client";

const COLORS = ["var(--cat-water)", "var(--cat-food)", "var(--cat-meds)", "var(--cat-check)", "var(--sun)"];

/** A short CSS confetti burst (skipped with reduced motion). */
export function Confetti({ seed }: { seed: string }) {
  const pieces = Array.from({ length: 36 }, (_, i) => {
    const h = [...`${seed}${i}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
    return { left: (h % 100) + "%", delay: ((h % 30) / 100).toFixed(2) + "s", color: COLORS[i % COLORS.length], rot: h % 360 };
  });
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden">
      {pieces.map((p, i) => (
        <i
          key={i}
          className="absolute -top-3 block h-3 w-2 rounded-[2px] [animation:confetti-fall_1.6s_ease-in_forwards]"
          style={{ left: p.left, background: p.color, animationDelay: p.delay, transform: `rotate(${p.rot}deg)` }}
        />
      ))}
    </div>
  );
}

/** New milestones and the day-closed moment: shown once, with confetti. */
export function Celebrate({ milestones, closedToday, date }: { milestones: { key: string; title: string; detail: string }[]; closedToday: boolean; date: string }) {
  const t = useT();
  const [hidden, setHidden] = useState(false);
  const [burst, setBurst] = useState(milestones.length > 0);

  // Celebrate closing the day once per day on this device, and tell the partner.
  useEffect(() => {
    if (!closedToday) return;
    const key = `hearth:closed:${date}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* storage unavailable: still celebrate */
    }
    const timer = setTimeout(() => setBurst(true), 0);
    void announceDayClosed();
    return () => clearTimeout(timer);
  }, [closedToday, date]);

  useEffect(() => {
    if (!burst) return;
    const id = setTimeout(() => setBurst(false), 2200);
    return () => clearTimeout(id);
  }, [burst]);

  return (
    <>
      {burst ? <Confetti seed={date} /> : null}
      {!hidden && milestones.length ? (
        <section className="relative rounded-[20px] bg-fg p-5 text-bg [animation:pop_.45s_ease-out]">
          <button className="absolute right-3 top-3 grid size-8 place-items-center rounded-full opacity-70 hover:opacity-100" aria-label={t("Close")} onClick={() => setHidden(true)}>
            <X className="size-4" aria-hidden />
          </button>
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] opacity-70">{t("Milestone")}</p>
          {milestones.map((m) => (
            <div key={m.key} className="mt-1">
              <p className="text-[20px] font-semibold tracking-tight">🏅 {t(m.title)}</p>
              <p className="text-[14px] opacity-80">{t(m.detail)}</p>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
