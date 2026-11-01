"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input, Notice, cx } from "@/components/ui";
import { saveKegelSession } from "./actions";

type Config = { sets: number; reps: number; hold: number; relax: number; flicks: number; rest: number };
type Step = { phase: "ready" | "squeeze" | "relax" | "rest" | "flick" | "flick-relax"; seconds: number; set: number; rep: number };

const DEFAULTS: Config = { sets: 3, reps: 10, hold: 5, relax: 5, flicks: 10, rest: 30 };
const STORAGE_KEY = "hearth.kegel.config";

function buildPlan(c: Config): Step[] {
  const plan: Step[] = [{ phase: "ready", seconds: 3, set: 1, rep: 0 }];
  for (let s = 1; s <= c.sets; s++) {
    for (let r = 1; r <= c.reps; r++) {
      plan.push({ phase: "squeeze", seconds: c.hold, set: s, rep: r });
      plan.push({ phase: "relax", seconds: c.relax, set: s, rep: r });
    }
    if (s < c.sets) plan.push({ phase: "rest", seconds: c.rest, set: s, rep: c.reps });
  }
  for (let f = 1; f <= c.flicks; f++) {
    plan.push({ phase: "flick", seconds: 1, set: c.sets, rep: f });
    plan.push({ phase: "flick-relax", seconds: 1, set: c.sets, rep: f });
  }
  return plan;
}

const LABEL: Record<Step["phase"], string> = {
  ready: "Get ready",
  squeeze: "Squeeze & hold",
  relax: "Relax",
  rest: "Rest",
  flick: "Quick squeeze",
  "flick-relax": "Let go",
};

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function KegelTrainer({ ownerId }: { ownerId: string }) {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [plan, setPlan] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const startedAt = useRef<number>(0);
  const audio = useRef<AudioContext | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setConfig(loadConfig()), 0);
    return () => window.clearTimeout(t);
  }, []);

  const cue = useCallback((phase: Step["phase"]) => {
    try {
      navigator.vibrate?.(phase === "squeeze" || phase === "flick" ? 200 : 60);
      const ctx = audio.current;
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = phase === "squeeze" || phase === "flick" ? 660 : 440;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      /* cues are optional */
    }
  }, []);

  const finish = useCallback(
    async (completed: boolean) => {
      const duration = Math.round((Date.now() - startedAt.current) / 1000);
      setPlan(null);
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
      if (!completed && duration < 20) return;
      const res = await saveKegelSession({
        ownerId,
        sets: config.sets,
        reps: config.reps,
        hold_seconds: config.hold,
        relax_seconds: config.relax,
        quick_flicks: config.flicks,
        completed,
        duration_seconds: duration,
      });
      setMessage(res.error ? { tone: "danger", text: res.error } : { tone: "accent", text: res.message ?? "Saved." });
    },
    [config, ownerId],
  );

  // Timer state lives in a ref so the interval callback can advance phases without stale closures.
  const timer = useRef({ index: 0, left: 0 });
  useEffect(() => {
    if (!plan || paused) return;
    const id = window.setInterval(() => {
      const t = timer.current;
      if (t.left > 1) {
        t.left -= 1;
        setLeft(t.left);
        return;
      }
      const next = t.index + 1;
      if (next >= plan.length) {
        window.clearInterval(id);
        void finish(true);
        return;
      }
      t.index = next;
      t.left = plan[next].seconds;
      setIndex(next);
      setLeft(t.left);
      cue(plan[next].phase);
    }, 1000);
    return () => window.clearInterval(id);
  }, [plan, paused, cue, finish]);

  async function start() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* ignore */
    }
    try {
      audio.current = audio.current ?? new AudioContext();
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      /* optional */
    }
    const p = buildPlan(config);
    startedAt.current = Date.now();
    setMessage(null);
    setPaused(false);
    timer.current = { index: 0, left: p[0].seconds };
    setIndex(0);
    setLeft(p[0].seconds);
    setPlan(p);
  }

  if (plan) {
    const step = plan[index];
    const squeezing = step.phase === "squeeze" || step.phase === "flick";
    const total = plan.reduce((a, s) => a + s.seconds, 0);
    const done = plan.slice(0, index).reduce((a, s) => a + s.seconds, 0) + (step.seconds - left);
    return (
      <Card className="flex flex-col items-center gap-5 py-8 text-center">
        <p className="text-sm text-fg-muted">
          {step.phase.startsWith("flick") ? `Quick flicks ${step.rep}/${config.flicks}` : step.phase === "ready" ? "Starting" : `Set ${step.set}/${config.sets} · rep ${step.rep}/${config.reps}`}
        </p>
        <div className="relative flex size-56 items-center justify-center" aria-live="polite">
          <div
            className={cx(
              "absolute rounded-full transition-all ease-in-out",
              squeezing ? "size-28 bg-accent duration-700" : step.phase === "rest" ? "size-48 bg-surface-2 duration-1000" : "size-52 bg-accent-soft duration-1000",
            )}
          />
          <div className="relative">
            <p className={cx("text-xl font-semibold", squeezing && "text-accent-fg")}>{LABEL[step.phase]}</p>
            <p className={cx("text-4xl font-bold tabular-nums", squeezing && "text-accent-fg")}>{left}</p>
          </div>
        </div>
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</Button>
          <Button variant="danger" onClick={() => finish(false)}>Stop</Button>
        </div>
        <p className="max-w-xs text-xs text-fg-muted">Breathe normally. Don&apos;t squeeze your buttocks, thighs or stomach.</p>
      </Card>
    );
  }

  const num = (k: keyof Config, label: string, min: number, max: number) => (
    <Field label={label}>
      <Input type="number" min={min} max={max} value={config[k]} onChange={(e) => setConfig({ ...config, [k]: Math.min(max, Math.max(min, Number(e.target.value) || min)) })} />
    </Field>
  );

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {num("sets", "Sets", 1, 10)}
        {num("reps", "Reps", 1, 50)}
        {num("hold", "Hold (s)", 1, 60)}
        {num("relax", "Relax (s)", 1, 60)}
        {num("rest", "Rest (s)", 5, 120)}
        {num("flicks", "Quick flicks", 0, 50)}
      </div>
      <Button className="w-full sm:w-auto" onClick={start}>▶ Start session</Button>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </Card>
  );
}
