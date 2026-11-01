import { ModuleShell } from "@/components/module-shell";

export default function SubscriptionsLayout({ children }: LayoutProps<"/subscriptions">) {
  return (
    <ModuleShell moduleKey="subscriptions" subtitle="What the household pays for (Netflix, Prime, Zomato Gold…), who pays and when it renews. Real accounting stays in your finance app.">
      {children}
    </ModuleShell>
  );
}
