"use client";

import Link from "next/link";
import { Droplet, Smile, Utensils } from "lucide-react";
import type { NextUpItem } from "@/modules/engagement/rings";
import { DoseButtons } from "@/app/(app)/medicines/dose-buttons";
import { SupplementTakeButton } from "@/app/(app)/supplements/take-button";
import { WaterButtons } from "@/components/water-buttons";
import { ModuleIcon } from "@/components/icons";
import { buttonClass, cx } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/** "Next up": the few things worth doing now, each with its action right there. */
export function NextUp({ items, ownerId, date, past = false }: { items: NextUpItem[]; ownerId: string; date: string; /** An earlier day: everything missed, logged for that date. */ past?: boolean }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{past ? t("Missed that day") : t("Next up")}</h2>
      <ul className="divide-y divide-border rounded-[20px] bg-surface px-4 shadow-[0_0_0_1px_var(--border)]">
        {items.map((i, k) => (
          <li key={k} className="flex items-center gap-3 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-muted">
              {i.kind === "dose" ? <ModuleIcon moduleKey="medicines" className="size-[18px]" /> : i.kind === "supplement" ? <ModuleIcon moduleKey="supplements" className="size-[18px]" /> : i.kind === "water" ? <Droplet className="size-[18px]" aria-hidden /> : i.kind === "meal" ? <Utensils className="size-[18px]" aria-hidden /> : <Smile className="size-[18px]" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              {i.kind === "dose" ? (
                <>
                  <p className="truncate text-[15px] font-medium">{i.name} <span className="font-normal text-fg-muted">{i.strength}</span></p>
                  <p className={cx("text-[13px]", i.overdue ? "text-danger" : "text-fg-muted")}>{i.overdue ? t("Due at {time}", { time: i.time }) : t("At {time}", { time: i.time })}</p>
                </>
              ) : i.kind === "supplement" ? (
                <>
                  <p className="truncate text-[15px] font-medium">{i.name} <span className="font-normal text-fg-muted">{i.dose}</span></p>
                  <p className={cx("text-[13px]", i.overdue ? "text-danger" : "text-fg-muted")}>{i.time ? t("Supplement · around {time}", { time: i.time }) : t("Supplement")}</p>
                </>
              ) : i.kind === "water" ? (
                <>
                  <p className="text-[15px] font-medium">{t("Glass of water")}</p>
                  <p className="text-[13px] text-fg-muted tabular">{t(past ? "{ml} of {target} ml" : "{ml} of {target} ml · a little behind", { ml: i.ml.toLocaleString("en-IN"), target: i.target.toLocaleString("en-IN") })}</p>
                </>
              ) : i.kind === "meal" ? (
                <>
                  <p className="text-[15px] font-medium">{t("Log {meal}", { meal: t(i.meal === "breakfast" ? "Breakfast" : i.meal === "lunch" ? "Lunch" : "Dinner").toLowerCase() })}</p>
                  <p className="text-[13px] text-fg-muted">{t("Say it or snap it")}</p>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-medium">{past ? t("Check in for that day") : t("How was today?")}</p>
                  <p className="text-[13px] text-fg-muted">{t("Ten seconds: mood, energy, sleep")}</p>
                </>
              )}
            </div>
            {i.kind === "dose" ? (
              <DoseButtons medicineId={i.medicineId} ownerId={ownerId} date={date} time={i.time} doseId={null} />
            ) : i.kind === "supplement" ? (
              <SupplementTakeButton supplementId={i.supplementId} ownerId={ownerId} date={date} name={i.name} />
            ) : i.kind === "water" ? (
              <WaterButtons amounts={past ? [250, 500] : [250]} date={past ? date : undefined} />
            ) : i.kind === "meal" ? (
              <Link href={past ? `/food?date=${date}&meal=${i.meal}` : "/food"} className={buttonClass("soft", "sm")}>{t("Log")}</Link>
            ) : (
              <Link href={past ? `/checkin?date=${date}` : "/close"} className={buttonClass("soft", "sm")}>{t("Check in")}</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
