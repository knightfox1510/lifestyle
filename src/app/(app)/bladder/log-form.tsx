"use client";

import { useActionState, useState } from "react";
import { Card, Checkbox, Field, Input, Textarea, cx } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { BLADDER_TRIGGERS, DRINKS, LEAK_AMOUNTS, type ActionResult } from "@/lib/types";
import { AMOUNT_LABEL, DRINK_META, KIND_META, TRIGGER_LABEL } from "@/modules/bladder/meta";
import { logBladderEvent, logFluid } from "./actions";

type Mode = "leak" | "urge" | "void" | "drink";

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx("rounded-full border px-3 py-1.5 text-sm", on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted hover:bg-surface-2")}
    >
      {children}
    </button>
  );
}

/** `day`: an earlier day being filled in; entries start at noon on it (change the time as needed). */
export function BladderLogForm({ ownerId, day }: { ownerId: string; day?: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [time, setTime] = useState(day ? `${day}T12:00` : "");
  const [amount, setAmount] = useState<string>("small");
  const [urgency, setUrgency] = useState<number | null>(null);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [drink, setDrink] = useState<(typeof DRINKS)[number]>("water");
  const [volume, setVolume] = useState(250);
  const [caffeinated, setCaffeinated] = useState(false);

  const reset = () => {
    setTime("");
    setAmount("small");
    setUrgency(null);
    setTriggers([]);
    setMode(null);
  };
  const wrap = (fn: (p: ActionResult | null, f: FormData) => Promise<ActionResult>) => async (p: ActionResult | null, f: FormData) => {
    const res = await fn(p, f);
    if (res.ok) reset();
    return res;
  };
  const [eventState, eventAction] = useActionState(wrap(logBladderEvent), null);
  const [fluidState, fluidAction] = useActionState(wrap(logFluid), null);
  const occurredAt = time ? new Date(time).toISOString() : "";

  const buttons: { mode: Mode; label: string; icon: string }[] = [
    { mode: "leak", ...KIND_META.leak },
    { mode: "urge", ...KIND_META.urge },
    { mode: "void", ...KIND_META.void },
    { mode: "drink", label: "Drink", icon: "🥤" },
  ];

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {buttons.map((b) => (
          <button
            key={b.mode}
            type="button"
            onClick={() => setMode(mode === b.mode ? null : b.mode)}
            className={cx(
              "flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm font-medium",
              mode === b.mode ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2",
            )}
          >
            <span className="text-2xl" aria-hidden>{b.icon}</span>
            {b.label}
          </button>
        ))}
      </div>
      {!mode ? (
        <>
          <ActionMessage state={eventState} />
          <ActionMessage state={fluidState} />
        </>
      ) : null}

      {mode && mode !== "drink" ? (
        <form action={eventAction} className="space-y-4">
          <input type="hidden" name="ownerId" value={ownerId} />
          <input type="hidden" name="kind" value={mode} />
          <input type="hidden" name="occurred_at" value={occurredAt} />
          {mode === "leak" ? <input type="hidden" name="amount" value={amount} /> : null}
          <input type="hidden" name="urgency" value={urgency ?? ""} />
          {triggers.map((t) => (
            <input key={t} type="hidden" name="triggers" value={t} />
          ))}

          {mode === "leak" ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">How much?</p>
              <div className="flex flex-wrap gap-1.5">
                {LEAK_AMOUNTS.map((a) => (
                  <Chip key={a} on={amount === a} onClick={() => setAmount(a)}>{AMOUNT_LABEL[a]}</Chip>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Urgency <span className="font-normal text-fg-muted">(1 = none, 5 = couldn&apos;t wait)</span></p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} on={urgency === n} onClick={() => setUrgency(urgency === n ? null : n)}>{n}</Chip>
              ))}
            </div>
          </div>

          {mode !== "void" ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">What were you doing?</p>
              <div className="flex flex-wrap gap-1.5">
                {BLADDER_TRIGGERS.map((t) => (
                  <Chip key={t} on={triggers.includes(t)} onClick={() => setTriggers(triggers.includes(t) ? triggers.filter((x) => x !== t) : [...triggers, t])}>
                    {TRIGGER_LABEL[t]}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="When" hint="Leave empty for now">
              <Input type="datetime-local" value={time} max={nowLocal()} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" maxLength={1000} className="min-h-10" placeholder="e.g. during squats, 3rd set" />
            </Field>
          </div>
          {mode === "leak" ? <Checkbox name="pad_changed" label="Changed pad" /> : null}
          <SubmitButton>Save {KIND_META[mode].label.toLowerCase()}</SubmitButton>
          <ActionMessage state={eventState} />
        </form>
      ) : null}

      {mode === "drink" ? (
        <form action={fluidAction} className="space-y-4">
          <input type="hidden" name="ownerId" value={ownerId} />
          <input type="hidden" name="drink" value={drink} />
          <input type="hidden" name="occurred_at" value={occurredAt} />
          <div className="flex flex-wrap gap-1.5">
            {DRINKS.map((d) => (
              <Chip
                key={d}
                on={drink === d}
                onClick={() => {
                  setDrink(d);
                  setCaffeinated(DRINK_META[d].caffeinated);
                }}
              >
                {DRINK_META[d].icon} {DRINK_META[d].label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {[100, 150, 250, 330, 500].map((v) => (
              <Chip key={v} on={volume === v} onClick={() => setVolume(v)}>{v} ml</Chip>
            ))}
            <Field label="ml" className="w-24">
              <Input name="volume_ml" type="number" min={10} max={3000} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="When" hint="Leave empty for now">
              <Input type="datetime-local" value={time} max={nowLocal()} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <div className="self-center">
              <Checkbox name="caffeinated" checked={caffeinated} onChange={(e) => setCaffeinated(e.target.checked)} label="Contains caffeine" />
            </div>
          </div>
          <SubmitButton>Save drink</SubmitButton>
          <ActionMessage state={fluidState} />
        </form>
      ) : null}
    </Card>
  );
}
