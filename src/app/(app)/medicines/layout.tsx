import { ModuleShell } from "@/components/module-shell";

export default function MedicinesLayout({ children }: LayoutProps<"/medicines">) {
  return (
    <ModuleShell
      moduleKey="medicines"
      subtitle="Prescriptions and short courses: today's doses, stock and refills."
      tabs={[
        { href: "/medicines", label: "Today" },
        { href: "/medicines/manage", label: "Medicines" },
        { href: "/medicines/history", label: "History" },
        { href: "/medicines/checks", label: "Safety checks" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
