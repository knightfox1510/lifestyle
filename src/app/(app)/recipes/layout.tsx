import { ModuleShell } from "@/components/module-shell";

export default function RecipesLayout({ children }: LayoutProps<"/recipes">) {
  return (
    <ModuleShell
      moduleKey="recipes"
      subtitle="Your household's recipes and a weekly meal plan that fills the grocery list for you."
      tabs={[
        { href: "/recipes", label: "Recipes" },
        { href: "/recipes/plan", label: "Meal plan" },
        { href: "/food/ideas", label: "✨ Ideas" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
