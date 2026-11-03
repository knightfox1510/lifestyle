"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Droplet, Pill, Scale, Smile, Utensils, X, Toilet } from "lucide-react";
import { Button, Skeleton, cx } from "@/components/ui";
import { QuickLogBox } from "@/components/quick-log-box";
import { QuickWeighIn } from "@/components/phase1-widgets";
import { CheckinForm } from "@/app/(app)/checkin/checkin-form";
import { quickLog } from "@/app/(app)/bladder/actions";
import { logDose } from "@/app/(app)/medicines/actions";
import { logWater } from "@/lib/water-actions";
import { getQuickLogData, undoQuickLog, type DueDose, type DueSupplement } from "@/lib/quick-actions";
import { toggleSupplement } from "@/app/(app)/supplements/actions";
import { useT } from "@/lib/i18n/client";
import { haptic, useToast } from "@/components/toaster";

export type QuickLogConfig = { ownerId: string; medicines: boolean; supplements?: boolean; bladder: boolean; body: boolean; checkin: boolean; food: boolean };
type Step = null | "dose" | "water" | "food" | "bladder" | "weight" | "check";
type Data = Awaited<ReturnType<typeof getQuickLogData>>;

/** The ＋ sheet: everything you log daily, in two taps. */
export function QuickLogSheet({ open, onClose, config }: { open: boolean; onClose: () => void; config: QuickLogConfig }) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(null);
  const [data, setData] = useState<Data | null>(null);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<{ id: number; label: string; undo?: () => Promise<unknown> }[]>([]);
  const seq = useRef(0);
  const panel = useRef<HTMLDivElement>(null);

  // Load fresh data each time the sheet opens; reset the step when it closes.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getQuickLogData().then((d) => alive && setData(d));
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    onClose();
    setStep(null);
    if (added.length) router.refresh();
    setAdded([]);
  }

  /** Logged: stay open for the next entry, list it under "Added" with Undo. */
  function done(message: string, undo?: { kind: "water" | "bladder" | "dose" | "supplement"; id?: string }, doseKey?: string) {
    haptic();
    const id = ++seq.current;
    setAdded((xs) => [...xs, { id, label: message, undo: undo?.id ? () => undoQuickLog(undo.kind, undo.id!) : undefined }]);
    if (doseKey && data) setData({ ...data, due: data.due.filter((d) => `${d.medicineId}-${d.time}` !== doseKey) });
    setStep(null);
  }

  async function undoAdded(id: number) {
    const item = added.find((x) => x.id === id);
    setAdded((xs) => xs.filter((x) => x.id !== id));
    await item?.undo?.();
    toast(t("Undone"));
    getQuickLogData().then(setData);
  }

  if (!open) return null;

  const tiles = [
    { key: "dose" as const, on: config.medicines || Boolean(config.supplements), label: t("Dose"), Icon: Pill, tint: "text-cat-meds" },
    { key: "water" as const, on: true, label: t("Water"), Icon: Droplet, tint: "text-cat-water" },
    { key: "food" as const, on: config.food, label: t("Food"), Icon: Utensils, tint: "text-cat-food" },
    { key: "bladder" as const, on: config.bladder, label: t("Bladder"), Icon: Toilet, tint: "text-fg" },
    { key: "weight" as const, on: config.body, label: t("Weight"), Icon: Scale, tint: "text-fg" },
    { key: "check" as const, on: config.checkin, label: t("Check-in"), Icon: Smile, tint: "text-cat-check" },
  ].filter((x) => x.on);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="presentation">
      <button aria-label={t("Close")} className="absolute inset-0 bg-black/35 backdrop-blur-[2px] [animation:fade-in_.15s]" onClick={close} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("Quick log")}
        className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-bg px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 outline-none [animation:sheet-up_.28s_cubic-bezier(.2,.9,.3,1)] md:rounded-[28px] md:pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          {step ? (
            <button className="pressable -ml-1 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-fg-muted" onClick={() => setStep(null)}>
              <ArrowLeft className="size-4" aria-hidden /> {t("Back")}
            </button>
          ) : (
            <h2 className="text-[20px] font-semibold">{t("What to log?")}</h2>
          )}
          <button className="pressable grid size-9 place-items-center rounded-full bg-surface-2" onClick={close} aria-label={t("Close")}>
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {added.length ? (
          <div className="mb-4 space-y-1.5 rounded-[18px] bg-accent-soft p-3">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-accent">{t("Added")}</p>
            <ul className="space-y-1">
              {added.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-[14px] [animation:toast-in_.2s_ease-out]">
                  <span className="flex min-w-0 items-center gap-1.5"><Check className="size-4 shrink-0 text-accent" aria-hidden /> <span className="truncate">{a.label}</span></span>
                  {a.undo ? <button className="shrink-0 text-[13px] text-fg-muted underline" onClick={() => undoAdded(a.id)}>{t("Undo")}</button> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === null ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {tiles.map(({ key, label, Icon, tint }) => (
                <button
                  key={key}
                  onClick={() => setStep(key)}
                  className="pressable flex aspect-[1.05] flex-col items-center justify-center gap-2 rounded-[20px] bg-surface text-[14px] font-medium shadow-[0_0_0_1px_var(--border)]"
                >
                  <Icon className={cx("size-7", tint)} strokeWidth={1.75} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-[20px] bg-surface p-3 shadow-[0_0_0_1px_var(--border)]">
              <p className="mb-2 text-[13px] font-medium text-fg-muted">{t("Or just say it, several things at once (e.g. 2 idlis, chai and a glass of water)")}</p>
              <QuickLogBox ownerId={config.ownerId} compact />
            </div>
            {added.length ? (
              <Button variant="primary" className="mt-4 w-full" onClick={close}>
                {t("Done · {n} added", { n: added.length })}
              </Button>
            ) : null}
          </>
        ) : null}

        {step === "water" ? (
          <div className="grid grid-cols-3 gap-2">
            {[150, 250, 500].map((ml) => (
              <Button
                key={ml}
                variant={ml === 250 ? "accent" : "secondary"}
                className="!h-16 !rounded-[18px] text-lg"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await logWater(ml);
                    if (r.error) toast(r.error, { tone: "error" });
                    else done(r.message ?? `+${ml} ml`, { kind: "water", id: r.id });
                  })
                }
              >
                +{ml}
              </Button>
            ))}
          </div>
        ) : null}

        {step === "dose" ? (
          !data ? (
            <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : data.due.length === 0 && !(data.dueSupplements ?? []).length ? (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm">✓ {t("All doses for today are done.")}</p>
          ) : (
            <ul className="space-y-2">
              {data.due.map((d: DueDose) => (
                <li key={`${d.medicineId}-${d.time}`} className="flex items-center gap-3 rounded-[18px] bg-surface p-3 shadow-[0_0_0_1px_var(--border)]">
                  <span className={cx("font-mono text-sm tabular", d.overdue ? "text-danger" : "text-fg-muted")}>{d.time}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{d.name} <span className="font-normal text-fg-muted">{d.strength}</span></span>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await logDose(d.medicineId, config.ownerId, d.date, d.time, "taken");
                        if (r.error) toast(r.error, { tone: "error" });
                        else done(t("{name} taken", { name: d.name }), { kind: "dose", id: r.id }, `${d.medicineId}-${d.time}`);
                      })
                    }
                  >
                    <Check className="size-4" aria-hidden /> {t("Take")}
                  </Button>
                </li>
              ))}
              {(data.dueSupplements ?? []).map((x: DueSupplement) => (
                <li key={`s-${x.supplementId}`} className="flex items-center gap-3 rounded-[18px] bg-surface p-3 shadow-[0_0_0_1px_var(--border)]">
                  <span className="font-mono text-sm tabular text-fg-muted">{x.time ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{x.name} <span className="font-normal text-fg-muted">{x.dose ?? t("supplement")}</span></span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await toggleSupplement(x.supplementId, config.ownerId, x.date, true);
                        if (r.error) toast(r.error, { tone: "error" });
                        else {
                          done(t("{name} taken", { name: x.name }), { kind: "supplement", id: `${x.supplementId}|${x.date}` });
                          setData((cur) => (cur ? { ...cur, dueSupplements: (cur.dueSupplements ?? []).filter((y) => y.supplementId !== x.supplementId) } : cur));
                        }
                      })
                    }
                  >
                    <Check className="size-4" aria-hidden /> {t("Take")}
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {step === "bladder" ? (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["leak", t("Leak")],
                ["urge", t("Urge")],
                ["void", t("Bathroom")],
              ] as const
            ).map(([kind, label]) => (
              <Button
                key={kind}
                variant="secondary"
                className="!h-16 !rounded-[18px]"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await quickLog(config.ownerId, kind);
                    if (r.error) toast(r.error, { tone: "error" });
                    else done(t("{what} logged", { what: label }), { kind: "bladder", id: r.id });
                  })
                }
              >
                {label}
              </Button>
            ))}
            <Link href="/bladder" onClick={close} className="col-span-3 mt-1 text-center text-sm text-fg-muted underline">
              {t("Add details (amount, trigger)")}
            </Link>
          </div>
        ) : null}

        {step === "weight" ? <QuickWeighIn ownerId={config.ownerId} last={data?.lastWeight ?? null} /> : null}

        {step === "check" ? (
          data ? (
            <CheckinForm ownerId={config.ownerId} date={data.today} checkin={data.checkin} compact canWrite />
          ) : (
            <Skeleton className="h-40" />
          )
        ) : null}

        {step === "food" ? (
          <div className="space-y-3">
            <QuickLogBox ownerId={config.ownerId} />
            <Link href="/food" onClick={close} className="block text-center text-sm text-fg-muted underline">
              {t("Open the food diary (photos, recipes, Indian dishes)")}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
