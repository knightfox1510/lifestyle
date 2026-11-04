"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TAB_MATCH } from "@/modules/areas";

/** Which bottom tab a path belongs to (0 Today, 1 Health, 2 Food, 3 Family). */
export function tabIndexOf(path: string) {
  if (path === "/" || path.startsWith("/?")) return 0;
  const hit = (list: readonly string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));
  if (hit(TAB_MATCH.health)) return 1;
  if (hit(TAB_MATCH.food)) return 2;
  if (hit(TAB_MATCH.family)) return 3;
  return -1;
}

/**
 * Switching tabs slides the page in the direction of the tab (left to right
 * along the tab bar); moving within a tab stays instant. Uses the browser's
 * View Transitions (skipped where unsupported, and with reduced motion).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  const tab = tabIndexOf(path);
  return (
    <ViewTransition
      key={tab >= 0 ? `tab-${tab}` : path.split("/")[1] || "home"}
      enter={{ "tab-forward": "tab-forward", "tab-back": "tab-back", default: "none" }}
      exit={{ "tab-forward": "tab-forward", "tab-back": "tab-back", default: "none" }}
      default="none"
    >
      <div>{children}</div>
    </ViewTransition>
  );
}
