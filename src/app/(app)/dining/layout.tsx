import { ModuleShell } from "@/components/module-shell";

export default function DiningLayout({ children }: LayoutProps<"/dining">) {
  return (
    <ModuleShell moduleKey="dining" area="food" subtitle="Your favourite local places and go-to orders. On lazy nights, AI picks what to order for each of you based on calories left and health data.">
      {children}
    </ModuleShell>
  );
}
