import { ModuleShell } from "@/components/module-shell";

export default function BodyLayout({ children }: LayoutProps<"/body">) {
  return (
    <ModuleShell
      moduleKey="body_recomp"
      subtitle="Weight, measurements and vitals over time, against your target and the calories you eat."
      tabs={[
        { href: "/body", label: "Progress" },
        { href: "/body/vitals", label: "Vitals" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
