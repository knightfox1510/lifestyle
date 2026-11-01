import { ModuleShell } from "@/components/module-shell";

export default function FoodLayout({ children }: LayoutProps<"/food">) {
  return (
    <ModuleShell
      moduleKey="food_diary"
      subtitle="What you eat against your goals. Describe it, say it or snap it, and AI estimates the calories and macros."
      tabs={[
        { href: "/food", label: "Diary" },
        { href: "/food/report", label: "Weekly report" },
        { href: "/food/foods", label: "My foods" },
        { href: "/food/ideas", label: "Meal ideas" },
        { href: "/food/goals", label: "Goals" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
