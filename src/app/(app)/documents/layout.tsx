import { ModuleShell } from "@/components/module-shell";

export default function DocumentsLayout({ children }: LayoutProps<"/documents">) {
  return (
    <ModuleShell moduleKey="documents" subtitle="Expiry dates for passports, visas, IDs, insurance and warranties, with reminders 60 days ahead. Only the last 4 digits of any number are stored.">
      {children}
    </ModuleShell>
  );
}
