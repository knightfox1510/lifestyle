import { ModuleShell } from "@/components/module-shell";

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleShell moduleKey="private_log" subtitle="Only you see this unless you share it in Settings → Sharing. Never sent to AI unless you allow drinks below.">
      {children}
    </ModuleShell>
  );
}
