import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { loadPatternDays } from "@/lib/patterns-data";
import { findPatterns, RULES } from "@/modules/patterns";

export const metadata = { title: "Patterns" };

const AREA_ICON = { food: "🍽️", sleep: "😴", bladder: "💧", mood: "🙂", activity: "🚶" } as const;
const NEED: Record<string, string> = {
  "sleep-kcal": "sleep (band or check-in) and full days of food",
  "sleep-energy": "sleep and check-ins with energy",
  "sleep-leaks": "sleep and the bladder diary",
  "caffeine-leaks": "drinks (with tea/coffee) and the bladder diary",
  "fluid-leaks": "drinks and the bladder diary",
  "weekend-kcal": "full days of food",
  "stress-kcal": "check-ins with stress and full days of food",
  "steps-sleep": "steps and sleep from your band",
  "workout-sleep": "workouts and sleep",
  "workout-mood": "workouts and check-ins with mood",
  "sleep-steps": "sleep and steps",
};

/** "What affects what": comparisons across the last 90 days of your own data. */
export default async function PatternsPage() {
  const session = await getSession();
  const t = await getT(session);
  const days = await loadPatternDays(session, session.subject.user_id);
  const { found, needMore } = findPatterns(days);
  const missing = [...new Set(needMore.map((id) => NEED[id]).filter(Boolean))];
  return (
    <div className="space-y-4">
      <PageHeader title={t("Patterns")} subtitle={t("What seems to go with what, from the last 90 days of your own logs.")} />
      {found.length ? (
        <ul className="space-y-2.5">
          {found.map((p) => (
            <li key={p.id}>
              <Card className="flex gap-3">
                <span className="text-2xl" aria-hidden>{AREA_ICON[p.area]}</span>
                <div className="min-w-0 space-y-1">
                  <p className="text-[15px] leading-snug">{p.text}</p>
                  <p className="text-xs text-fg-muted">
                    <Badge tone={p.strength === "clear" ? "accent" : "neutral"}>{p.strength === "clear" ? t("Clear pattern") : t("Possible pattern")}</Badge>{" "}
                    {t("{a} days vs {b} days", { a: p.a.n, b: p.b.n })}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("No clear patterns yet")}>{t("Keep logging: patterns show up once there are enough days on both sides of a comparison.")}</EmptyState>
      )}
      <Card className="space-y-1.5 text-sm">
        <p className="font-medium">{t("How this works")}</p>
        <p className="text-fg-muted">{t("Days are split into two groups (say, short and good nights) and something else is compared between them. A pattern is shown only when both groups have at least 5 days and the gap is big next to your usual day-to-day ups and downs. It shows what tends to go together, not what causes what.")}</p>
        {missing.length ? <p className="text-fg-muted">{t("More would show with more days of:")} {missing.join("; ")}.</p> : null}
        <p className="text-fg-muted">{t("Checked: {n} comparisons.", { n: RULES.filter((r) => !r.private).length })} <Link href="/body/coach" className="text-accent underline">{t("Ask the AI coach what to do about them")}</Link></p>
      </Card>
    </div>
  );
}
