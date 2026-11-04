"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { finishWelcome } from "./actions";

/** Three steps with a progress bar; each step's content comes from the server page. */
export function WelcomeSteps({ steps }: { steps: { title: string; intro: string; body: ReactNode }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [i, setI] = useState(0);
  const [pending, start] = useTransition();
  const last = i === steps.length - 1;
  const done = () =>
    start(async () => {
      await finishWelcome();
      toast("You're all set", { kind: "habit" });
      router.push("/");
    });
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${steps.length}`}>
        {steps.map((_, k) => (
          <span key={k} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className={cx("block h-full origin-left rounded-full bg-accent transition-transform duration-500", k <= i ? "scale-x-100" : "scale-x-0")} />
          </span>
        ))}
      </div>
      <section key={i} className="space-y-3 [animation:toast-in_.25s_ease-out]">
        <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">Step {i + 1} of {steps.length}</p>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">{steps[i].title}</h1>
        <p className="text-sm text-fg-muted">{steps[i].intro}</p>
        <div>{steps[i].body}</div>
      </section>
      <div className="flex items-center gap-2 pt-2">
        {i > 0 ? <Button variant="ghost" onClick={() => setI(i - 1)}>Back</Button> : <Button variant="ghost" disabled={pending} onClick={done}>Skip for now</Button>}
        <Button className="ml-auto" pending={pending} onClick={() => (last ? done() : setI(i + 1))}>{last ? "Finish" : "Next"}</Button>
      </div>
    </div>
  );
}
