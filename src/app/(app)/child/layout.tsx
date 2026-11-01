import { ModuleShell } from "@/components/module-shell";

export default function ChildLayout({ children }: LayoutProps<"/child">) {
  return (
    <ModuleShell
      moduleKey="child"
      subtitle="Shared by both parents: feeds, naps, nappies, medicine doses, vaccinations and growth."
      tabs={[
        { href: "/child", label: "Today" },
        { href: "/child/health", label: "Vaccinations & growth" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
