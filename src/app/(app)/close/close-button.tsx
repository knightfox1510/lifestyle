"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Confetti } from "@/components/today/celebrate";
import { announceDayClosed } from "@/lib/engagement-actions";
import { useT } from "@/lib/i18n/client";

/** Finishes the review: celebration, partner nudge, back to Today. */
export function CloseDayButton({ allDone, streak }: { allDone: boolean; streak: number }) {
  const t = useT();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className="space-y-1 rounded-[24px] bg-fg p-6 text-center text-bg [animation:pop_.45s_ease-out]">
        <Confetti seed="close" />
        <p className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular">🔥 {streak}</p>
        <p className="text-[17px] font-medium">{allDone ? t("Day closed. Nicely done.") : t("Saved. Tomorrow is a fresh start.")}</p>
      </div>
    );
  }
  return (
    <Button
      variant="accent"
      className="!h-14 w-full text-[16px]"
      pending={pending}
      onClick={() =>
        start(async () => {
          if (allDone) await announceDayClosed();
          setDone(true);
          setTimeout(() => router.push("/"), 2400);
        })
      }
    >
      {allDone ? t("Close my day") : t("Done for today")}
    </Button>
  );
}
