import Link from "next/link";
import { getSession } from "@/lib/session";
import { MODULES } from "@/modules/registry";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "All features" };

export default async function MorePage() {
  const session = await getSession();
  const enabled = MODULES.filter((m) => m.href && session.isModuleEnabled(m.key));
  const extras = [
    { href: "/assistant", name: "Ask AI", icon: "✨", description: "Suggestions that consider your health data." },
    { href: "/customize", name: "Home widgets", icon: "🧩", description: "Choose what appears on Home." },
    { href: "/settings/household", name: "Features on/off", icon: "🎛️", description: "Turn features on or off for the household." },
  ];
  return (
    <>
      <PageHeader title="All features" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[...enabled.map((m) => ({ href: m.href!, name: m.name, icon: m.icon, description: m.description })), ...extras].map((m) => (
          <Link key={m.href} href={m.href} className="rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
            <span className="text-2xl" aria-hidden>{m.icon}</span>
            <p className="mt-2 text-sm font-medium">{m.name}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{m.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
