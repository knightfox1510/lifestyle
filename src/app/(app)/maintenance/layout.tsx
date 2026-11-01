import { ModuleShell } from "@/components/module-shell";

export default function MaintenanceLayout({ children }: LayoutProps<"/maintenance">) {
  return (
    <ModuleShell moduleKey="maintenance" subtitle="Easy-to-forget home jobs: AC filters, RO service, pest control, car service, insurance renewals.">
      {children}
    </ModuleShell>
  );
}
