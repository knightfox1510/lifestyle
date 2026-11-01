import { ModuleShell } from "@/components/module-shell";

export default function PelvicFloorLayout({ children }: LayoutProps<"/pelvic-floor">) {
  return (
    <ModuleShell
      moduleKey="pelvic_floor"
      subtitle="Guided pelvic floor (Kegel) training. Most programmes suggest 3 sets a day; ask your physio for the right hold times."
    >
      {children}
    </ModuleShell>
  );
}
