import { ListSkeleton } from "@/components/loading-shapes";

/** Shown the instant a link is tapped, shaped like the screen that's coming. */
export default function Loading() {
  return <ListSkeleton rows={5} />;
}
