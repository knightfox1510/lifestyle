import { ModuleShell } from "@/components/module-shell";

export default function CycleLayout({ children }: LayoutProps<"/cycle">) {
  return (
    <ModuleShell moduleKey="cycle" subtitle="Periods, symptoms and what to expect next. Private unless you share it in Settings → Sharing.">
      {children}
    </ModuleShell>
  );
}
