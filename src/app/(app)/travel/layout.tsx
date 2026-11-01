import { ModuleShell } from "@/components/module-shell";

export default function TravelLayout({ children }: LayoutProps<"/travel">) {
  return (
    <ModuleShell moduleKey="travel" subtitle="Trip ideas, links and day-by-day plans you build together, plus reusable packing lists.">
      {children}
    </ModuleShell>
  );
}
