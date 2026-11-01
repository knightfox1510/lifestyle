import { ModuleShell } from "@/components/module-shell";

export default function SupplementsLayout({ children }: LayoutProps<"/supplements">) {
  return (
    <ModuleShell moduleKey="supplements" subtitle="Your daily stack. The checklist starts fresh every morning; history is kept.">
      {children}
    </ModuleShell>
  );
}
