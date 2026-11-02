import { ModuleShell } from "@/components/module-shell";

export default function BladderLayout({ children }: LayoutProps<"/bladder">) {
  return (
    <ModuleShell
      moduleKey="bladder_diary" area="pelvic"
      subtitle="Leaks, urges, bathroom visits and drinks, in the format doctors and pelvic-floor physios use. Private unless you share it."
      tabs={[
        { href: "/bladder", label: "Diary" },
        { href: "/bladder/trends", label: "Trends & triggers" },
        { href: "/bladder/report", label: "Doctor report" },
        { href: "/bladder/import", label: "Import" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
