import { ModuleShell } from "@/components/module-shell";

export default function WearablesLayout({ children }: LayoutProps<"/wearables">) {
  return (
    <ModuleShell moduleKey="wearables" area="body" subtitle="Steps, sleep and heart rate from your band. Import a Zepp/Amazfit export, set up an automatic sync, or type it in.">
      {children}
    </ModuleShell>
  );
}
