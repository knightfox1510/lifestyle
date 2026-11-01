import { Badge, Card } from "@/components/ui";
import type { Finding } from "@/modules/medicines/checks";

export const SEVERITY_META = {
  high: { label: "Ask your doctor soon", tone: "danger", icon: "⛔" },
  medium: { label: "Worth checking", tone: "warn", icon: "⚠️" },
  info: { label: "Tip", tone: "neutral", icon: "💡" },
} as const;

export function FindingCard({ f, t }: { f: Pick<Finding, "severity" | "title" | "detail" | "medicines">; t: (s: string) => string }) {
  const m = SEVERITY_META[f.severity];
  return (
    <Card className="space-y-1 !p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden>{m.icon}</span>
        <p className="font-medium">{f.title}</p>
        <Badge tone={m.tone}>{t(m.label)}</Badge>
      </div>
      <p className="text-sm">{f.detail}</p>
      {f.medicines.length ? <p className="text-xs text-fg-muted">{f.medicines.join(" · ")}</p> : null}
    </Card>
  );
}
