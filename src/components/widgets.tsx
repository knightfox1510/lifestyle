import Link from "next/link";
import type { AppSession } from "@/lib/session";
import type { MedicalEvent, WidgetSize } from "@/lib/types";
import { Card, cx } from "@/components/ui";
import { CATEGORY_META, formatRange } from "@/modules/medical/meta";
import { WIDGET_BY_KEY } from "@/modules/widgets";
import { QuickHealthLog } from "@/components/quick-health-log";
import { AskAiWidget } from "@/components/ask-ai-widget";

const span: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-2 md:col-span-2",
  lg: "col-span-2 md:col-span-4",
};

export function WidgetFrame({ size, title, href, children }: { size: WidgetSize; title: string; href?: string; children: React.ReactNode }) {
  return (
    <Card className={cx(span[size], "flex min-w-0 flex-col gap-3")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="text-xs text-accent hover:underline">
            Open
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export async function Widget({ widgetKey, size, session }: { widgetKey: string; size: WidgetSize; session: AppSession }) {
  const def = WIDGET_BY_KEY[widgetKey];
  if (!def) return null;
  if (def.module && !session.isModuleEnabled(def.module)) return null;
  const subject = session.subject;
  const isSelf = subject.user_id === session.userId;

  switch (widgetKey) {
    case "core.today": {
      const now = new Date();
      const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: session.profile.timezone }).format(now));
      const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      return (
        <WidgetFrame size={size} title="Today">
          <div>
            <p className="text-xl font-semibold">
              {greeting}, {session.me.display_name}
            </p>
            <p className="text-sm text-fg-muted">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: session.profile.timezone })}
              {!isSelf ? ` · viewing ${subject.display_name}'s shared data` : ""}
            </p>
          </div>
        </WidgetFrame>
      );
    }

    case "core.ask_ai":
      return (
        <WidgetFrame size={size} title="✨ Ask AI" href="/assistant">
          <AskAiWidget />
        </WidgetFrame>
      );

    case "core.household": {
      const sharedOut = session.shares.filter((s) => s.owner_id === session.userId).length;
      const sharedIn = session.shares.filter((s) => s.grantee_id === session.userId).length;
      return (
        <WidgetFrame size={size} title="Household" href="/settings/household">
          <p className="text-sm">
            {session.household.name} · {session.members.map((m) => m.display_name).join(" & ")}
          </p>
          <p className="text-xs text-fg-muted">
            {session.partner
              ? `You share ${sharedOut} feature${sharedOut === 1 ? "" : "s"}; ${session.partner.display_name} shares ${sharedIn} with you.`
              : "Invite your partner to share and see each other's updates."}
          </p>
        </WidgetFrame>
      );
    }

    case "medical_records.timeline": {
      const access = session.accessTo("medical_records", subject.user_id);
      if (access === "none") {
        return (
          <WidgetFrame size={size} title="Health timeline">
            <p className="text-sm text-fg-muted">{subject.display_name} hasn&apos;t shared medical records.</p>
          </WidgetFrame>
        );
      }
      const { data } = await session.supabase
        .from("medical_events")
        .select("*")
        .eq("owner_id", subject.user_id)
        .order("start_date", { ascending: false })
        .limit(5);
      const events = (data ?? []) as MedicalEvent[];
      return (
        <WidgetFrame size={size} title={isSelf ? "Health timeline" : `${subject.display_name}'s health`} href="/medical">
          {events.length ? (
            <ul className="space-y-1.5 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">
                    {CATEGORY_META[e.category].icon} {e.title}
                  </span>
                  <span className="shrink-0 text-xs text-fg-muted">{formatRange(e.start_date, e.end_date, e.ongoing)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Nothing logged yet.</p>
          )}
        </WidgetFrame>
      );
    }

    case "medical_records.quick_log": {
      const canWrite = session.accessTo("medical_records", subject.user_id) === "write";
      return (
        <WidgetFrame size={size} title={isSelf ? "Quick health log" : `Log for ${subject.display_name}`}>
          {canWrite ? (
            <QuickHealthLog ownerId={subject.user_id} />
          ) : (
            <p className="text-sm text-fg-muted">You can&apos;t add entries for {subject.display_name}.</p>
          )}
        </WidgetFrame>
      );
    }

    default:
      return null;
  }
}
