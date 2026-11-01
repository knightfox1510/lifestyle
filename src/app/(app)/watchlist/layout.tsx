import { ModuleShell } from "@/components/module-shell";

export default function WatchlistLayout({ children }: LayoutProps<"/watchlist">) {
  return (
    <ModuleShell moduleKey="watchlist" subtitle="Shows you're watching together, with each person's episode, so nobody watches ahead by accident. Plus a backlog of movies and series.">
      {children}
    </ModuleShell>
  );
}
