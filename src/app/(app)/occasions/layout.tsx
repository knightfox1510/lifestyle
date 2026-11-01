import { ModuleShell } from "@/components/module-shell";

export default function OccasionsLayout({ children }: LayoutProps<"/occasions">) {
  return (
    <ModuleShell moduleKey="occasions" subtitle="Birthdays, anniversaries and other dates with reminders. Gift ideas are private to you, so surprises stay surprises.">
      {children}
    </ModuleShell>
  );
}
