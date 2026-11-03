"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { bookmarkletHref } from "@/modules/dining/bookmarklet";

/** How to install and use the "Copy menu to Hearth" bookmark. */
export function MenuGrabber() {
  const link = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  // React won't render javascript: links, so the bookmark's address is set on the element directly.
  useEffect(() => {
    const href = bookmarkletHref(window.location.origin);
    link.current?.setAttribute("href", href);
    const t = window.setTimeout(() => setCode(href), 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <details className="rounded-2xl border border-border bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">📋 Copy whole menus from Swiggy or Zomato (on a computer)</summary>
      <div className="mt-2 space-y-2 text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-fg-muted">
          <li>
            Drag this button to your browser&apos;s bookmarks bar (show it with Ctrl+Shift+B, or ⌘+Shift+B on a Mac):{" "}
            <a ref={link} onClick={(e) => e.preventDefault()} draggable className="ml-1 inline-flex cursor-grab items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-white no-underline">
              📋 Copy menu to Hearth
            </a>
          </li>
          <li>Open a restaurant&apos;s page on swiggy.com or zomato.com, as you normally would.</li>
          <li>Click the bookmark. It opens every menu section, copies the whole menu and opens Hearth in a new tab.</li>
          <li>In Hearth: pick or name the restaurant, tap <strong>Read menu</strong> (long menus are read in parts), check the dishes and save. You can also download the menu as a CSV there.</li>
        </ol>
        <p className="text-xs text-fg-muted">It only reads the page you have open, like copying it by hand: it doesn&apos;t log in, crawl other pages or send anything to Swiggy or Zomato. Do one restaurant at a time.</p>
        <p className="text-xs text-fg-muted">
          Can&apos;t drag? Add a bookmark by hand and paste this as its address:{" "}
          <Button size="sm" variant="ghost" disabled={!code} onClick={() => { void navigator.clipboard.writeText(code); setCopied(true); }}>{copied ? "✓ Copied" : "Copy bookmark code"}</Button>
        </p>
      </div>
    </details>
  );
}
