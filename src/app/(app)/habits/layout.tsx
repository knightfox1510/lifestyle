import { ModuleShell } from "@/components/module-shell";

export default function HabitsLayout({ children }: LayoutProps<"/habits">) {
  return (
    <ModuleShell moduleKey="habits" subtitle="Small daily habits with weekly targets. Tap a day to mark it done.">
      {children}
    </ModuleShell>
  );
}
