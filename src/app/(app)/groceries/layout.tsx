import { ModuleShell } from "@/components/module-shell";

export default function GroceriesLayout({ children }: LayoutProps<"/groceries">) {
  return (
    <ModuleShell moduleKey="groceries" area="food" subtitle="Shared with everyone in the household. Works offline in the shop; changes sync when you're back online.">
      {children}
    </ModuleShell>
  );
}
