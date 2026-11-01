import { getSession } from "@/lib/session";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { DEFAULT_WIDGETS, WIDGETS, WIDGET_BY_KEY } from "@/modules/widgets";
import type { UserWidget, WidgetSize } from "@/lib/types";
import { addWidget, moveWidget, removeWidget, resetWidgets, resizeWidget } from "../widget-actions";

export const metadata = { title: "Customize home" };

const SIZES: { value: WidgetSize; label: string }[] = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
];

export default async function CustomizePage() {
  const session = await getSession();
  const { data } = await session.supabase.from("user_widgets").select("*").eq("user_id", session.userId).order("position");
  const saved = (data ?? []) as UserWidget[];
  const current = saved.length
    ? saved.map((w) => ({ key: w.widget_key, size: w.size }))
    : DEFAULT_WIDGETS.map((key) => ({ key, size: WIDGET_BY_KEY[key].defaultSize }));
  const usable = (key: string) => {
    const mod = WIDGET_BY_KEY[key]?.module;
    return !mod || session.isModuleEnabled(mod);
  };
  const available = WIDGETS.filter((w) => !current.some((c) => c.key === w.key) && usable(w.key));

  return (
    <>
      <PageHeader title="Customize home" subtitle="Choose which quick-log widgets appear on Home, their order and size." />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-2 font-semibold">On your home</h2>
          <ul className="divide-y divide-border">
            {current.map((w, i) => {
              const def = WIDGET_BY_KEY[w.key];
              if (!def) return null;
              return (
                <li key={w.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{def.name}</p>
                    <p className="text-xs text-fg-muted">
                      {def.description}
                      {!usable(w.key) ? " (feature turned off)" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="Size">
                      {SIZES.map((s) => (
                        <form key={s.value} action={resizeWidget.bind(null, w.key, s.value)}>
                          <button
                            aria-pressed={w.size === s.value}
                            className={`h-7 w-7 rounded-md text-xs ${w.size === s.value ? "bg-surface font-semibold shadow-sm" : "text-fg-muted"}`}
                          >
                            {s.label}
                          </button>
                        </form>
                      ))}
                    </div>
                    <form action={moveWidget.bind(null, w.key, -1)}>
                      <button disabled={i === 0} aria-label="Move up" className={buttonClass("ghost", "sm")}>↑</button>
                    </form>
                    <form action={moveWidget.bind(null, w.key, 1)}>
                      <button disabled={i === current.length - 1} aria-label="Move down" className={buttonClass("ghost", "sm")}>↓</button>
                    </form>
                    <form action={removeWidget.bind(null, w.key)}>
                      <button className={buttonClass("danger", "sm")}>Remove</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Add widgets</h2>
          {available.length ? (
            <ul className="divide-y divide-border">
              {available.map((w) => (
                <li key={w.key} className="flex items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-fg-muted">{w.description}</p>
                  </div>
                  <form action={addWidget.bind(null, w.key)}>
                    <button className={buttonClass("secondary", "sm")}>Add</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">All widgets are on your home. More arrive as features are added.</p>
          )}
        </Card>

        <form action={resetWidgets}>
          <button className={buttonClass("ghost", "sm")}>Reset to default</button>
        </form>
      </div>
    </>
  );
}
