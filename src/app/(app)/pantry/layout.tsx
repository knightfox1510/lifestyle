import { ModuleShell } from "@/components/module-shell";

export default function PantryLayout({ children }: LayoutProps<"/pantry">) {
  return (
    <ModuleShell
      moduleKey="pantry" area="food"
      subtitle="What's in the fridge, freezer and cupboard, with expiry dates. Scan a receipt or a shelf to fill it in."
      tabs={[
        { href: "/pantry", label: "Pantry" },
        { href: "/pantry/scan", label: "📷 Scan" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
