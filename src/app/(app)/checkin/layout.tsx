import { ModuleShell } from "@/components/module-shell";

export default function CheckinLayout({ children }: LayoutProps<"/checkin">) {
  return (
    <ModuleShell moduleKey="checkin" subtitle="Ten seconds a day. Used to spot patterns with leaks, habits and medicines, and by AI suggestions.">
      {children}
    </ModuleShell>
  );
}
