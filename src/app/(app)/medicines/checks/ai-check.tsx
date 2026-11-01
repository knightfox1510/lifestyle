"use client";

import { useState } from "react";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

type AiFinding = { severity: "high" | "medium" | "info"; title: string; detail: string; medicines: string[] };
type AiResult = { findings: AiFinding[]; questions_for_doctor: string[]; note: string | null };

const ICON = { high: "⛔", medium: "⚠️", info: "💡" } as const;
const TONE = { high: "danger", medium: "warn", info: "neutral" } as const;

/** AI second look using the person's conditions, allergies and labs. */
export function AiMedicineCheck({ subjectId }: { subjectId: string }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/medicine-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subjectId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Check failed");
      setResult(body as AiResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">✨ {t("AI review")}</h2>
        <p className="text-sm text-fg-muted">{t("Also looks at your conditions, allergies, kidney/liver results and bladder symptoms. Uses your health data.")}</p>
      </div>
      <Button size="sm" onClick={run} disabled={loading}>{loading ? t("Reviewing…") : t("Review my medicines")}</Button>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {result ? (
        <div className="space-y-2">
          {result.findings.length === 0 ? <p className="text-sm">✓ {t("Nothing more to flag.")}</p> : null}
          {result.findings.map((f, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden>{ICON[f.severity]}</span>
                <p className="font-medium">{f.title}</p>
                <Badge tone={TONE[f.severity]}>{f.severity === "high" ? t("Ask your doctor soon") : f.severity === "medium" ? t("Worth checking") : t("Tip")}</Badge>
              </div>
              <p className="mt-1 text-sm">{f.detail}</p>
              {f.medicines.length ? <p className="text-xs text-fg-muted">{f.medicines.join(" · ")}</p> : null}
            </div>
          ))}
          {result.questions_for_doctor.length ? (
            <div>
              <p className="text-sm font-medium">{t("Questions to ask your doctor")}</p>
              <ul className="ml-5 list-disc text-sm">
                {result.questions_for_doctor.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.note ? <p className="text-xs text-fg-muted">{result.note}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
