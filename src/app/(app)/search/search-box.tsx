"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui";
import { searchPages, type PageEntry } from "@/modules/search";

type Hit = { group: string; title: string; hint: string | null; href: string };

const SUGGESTIONS = ["week plan", "BMI", "medicines", "blood test", "leaks", "groceries", "sharing", "reminders"];

/** Search screens and your own things (medicines, recipes, lab tests…) from one box. */
export function SearchBox({ pages, initial }: { pages: PageEntry[]; initial: string }) {
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const query = q.trim();

  useEffect(() => {
    if (query.length < 2) return;
    const id = ++seq.current;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const body = await res.json();
        if (id === seq.current) setHits(body.results ?? []);
      } catch {
        if (id === seq.current) setHits([]);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const pageHits = searchPages(pages, query);
  const shown = query.length >= 2 ? hits : [];
  const groups = [...new Set(shown.map((h) => h.group))];

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-fg-muted" aria-hidden />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search features, medicines, recipes, tests…" className="!h-12 !pl-11 text-base" aria-label="Search" type="search" />
      </div>

      {!query ? (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full border border-border px-3 py-1 text-sm text-fg-muted hover:text-fg">
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {pageHits.length ? (
        <Section title="Go to">
          {pageHits.map((p) => (
            <Row key={p.href} href={p.href} title={p.title} hint={p.hint} />
          ))}
        </Section>
      ) : null}

      {groups.map((g) => (
        <Section key={g} title={g}>
          {shown.filter((h) => h.group === g).map((h, i) => (
            <Row key={`${h.href}-${i}`} href={h.href} title={h.title} hint={h.hint} />
          ))}
        </Section>
      ))}

      {query.length >= 2 && !loading && !pageHits.length && !shown.length ? <p className="text-sm text-fg-muted">Nothing found for “{query}”.</p> : null}
      {loading && !shown.length ? <p className="text-xs text-fg-muted">Searching your data…</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="px-1 text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--border)]">{children}</ul>
    </section>
  );
}

function Row({ href, title, hint }: { href: string; title: string; hint: string | null }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/60">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          {hint ? <span className="block truncate text-xs text-fg-muted">{hint}</span> : null}
        </span>
        <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden />
      </Link>
    </li>
  );
}
