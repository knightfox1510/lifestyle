import { ModuleShell } from "@/components/module-shell";

export default function RecipesLayout({ children }: LayoutProps<"/recipes">) {
  return (
    <ModuleShell
      moduleKey="recipes" area="food"
      subtitle="Your household's recipes. Plan them into the week from Food → Week plan, which also fills the grocery list."
      tabs={[
        { href: "/recipes", label: "Recipes" },
        { href: "/food/ideas", label: "✨ Ideas" },
      ]}
    >
      {children}
    </ModuleShell>
  );
}
