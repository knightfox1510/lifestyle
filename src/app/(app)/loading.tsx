import { Skeleton } from "@/components/ui";

/**
 * Shown the instant a link is tapped while the next page renders on the
 * server. Also lets Next.js prefetch the app shell for dynamic pages.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
      </div>
      <Skeleton className="h-44" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}
