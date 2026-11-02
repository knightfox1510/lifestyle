import { ModuleShell } from "@/components/module-shell";

export default function FitnessLayout({ children }: LayoutProps<"/fitness">) {
  return (
    <ModuleShell
      moduleKey="fitness" area="body"
      subtitle="Your weekly classes (gym, yoga…) with reminders, and a log of what you actually did."
      tabs={[
        { href: "/fitness", label: "This week" },
        { href: "/fitness/classes", label: "Schedule" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
