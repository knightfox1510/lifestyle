import { ChartsSkeleton } from "@/components/loading-shapes";

/** Shown the instant a link is tapped, shaped like the screen that's coming. */
export default function Loading() {
  return <ChartsSkeleton tiles={3} charts={2} />;
}
