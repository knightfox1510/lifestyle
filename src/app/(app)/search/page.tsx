import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { pageIndex } from "@/modules/search";
import { SearchBox } from "./search-box";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const session = await getSession();
  const t = await getT(session);
  const { q } = await searchParams;
  // Only screens for features that are on for the person being viewed.
  const pages = pageIndex()
    .filter((p) => !p.module || session.isShown(p.module))
    .map((p) => ({ ...p, title: t(p.title), hint: t(p.hint) }));
  return <SearchBox pages={pages} initial={typeof q === "string" ? q : ""} />;
}
