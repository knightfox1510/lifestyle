import Link from "next/link";
import { getSession } from "@/lib/session";
import { DEFAULT_WIDGETS, WIDGET_BY_KEY } from "@/modules/widgets";
import type { UserWidget, WidgetSize } from "@/lib/types";
import { Widget } from "@/components/widgets";
import { InstallPrompt } from "@/components/install-prompt";

export default async function HomePage() {
  const session = await getSession();
  const { data } = await session.supabase.from("user_widgets").select("*").eq("user_id", session.userId).order("position");
  const saved = (data ?? []) as UserWidget[];
  const layout: { key: string; size: WidgetSize }[] = saved.length
    ? saved.map((w) => ({ key: w.widget_key, size: w.size }))
    : DEFAULT_WIDGETS.map((key) => ({ key, size: WIDGET_BY_KEY[key].defaultSize }));

  return (
    <div className="space-y-4">
      <InstallPrompt compact />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {layout.map((w) => (
          <Widget key={w.key} widgetKey={w.key} size={w.size} session={session} />
        ))}
      </div>
      <div className="text-center">
        <Link href="/customize" className="text-sm text-fg-muted hover:text-fg">
          🧩 Customize widgets
        </Link>
      </div>
    </div>
  );
}
