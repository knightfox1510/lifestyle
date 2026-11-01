"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { PeoplePortions, type PersonPortion } from "@/components/nutrition-ui";
import { mealForHour } from "@/modules/food/meta";
import { eatLeftover } from "./actions";

/** Log portions of a leftover (from its recipe's nutrition) and count them down. */
export function LeftoverEat({ pantryId, people, me }: { pantryId: string; people: PersonPortion[]; me: string }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<Record<string, number>>({ [me]: 1 });
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        🍽️ Eat a portion
      </Button>
    );
  }
  return (
    <div className="basis-full space-y-2 rounded-lg bg-surface-2 p-2">
      {people.length > 1 ? <PeoplePortions people={people} value={who} onChange={setWho} unit="serving" /> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !Object.values(who).some((v) => v > 0)}
          onClick={() =>
            start(async () => {
              const r = await eatLeftover(pantryId, Object.entries(who).filter(([, v]) => v > 0).map(([ownerId, servings]) => ({ ownerId, servings })), mealForHour(new Date().getHours()));
              setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Logged." });
            })
          }
        >
          Log to food diary
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </div>
  );
}
