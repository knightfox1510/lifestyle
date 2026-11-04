import { Skeleton } from "@/components/ui";

/** Loading outlines shaped like the screens they stand in for, so nothing jumps when the page arrives. */
export const Busy = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-4" aria-busy="true" aria-label="Loading">{children}</div>
);

export function FoodSkeleton() {
  return (
    <Busy>
      <div className="flex items-center justify-between"><Skeleton className="h-8 w-20 rounded-full" /><Skeleton className="h-8 w-28 rounded-full" /><Skeleton className="h-8 w-20 rounded-full" /></div>
      <div className="flex items-center gap-4 rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)]">
        <Skeleton className="size-[104px] shrink-0 rounded-full" />
        <div className="flex-1 space-y-2"><Skeleton className="h-5 w-40 rounded-lg" /><div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-6 rounded-lg" />)}</div></div>
      </div>
      <Skeleton className="h-28" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)]">
          <Skeleton className="size-7 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-28 rounded-md" /><Skeleton className="h-3 w-40 rounded-md" /></div><Skeleton className="h-8 w-16 rounded-full" />
        </div>
      ))}
    </Busy>
  );
}

export function HubSkeleton() {
  return (
    <Busy>
      <div className="space-y-2"><Skeleton className="h-8 w-40 rounded-xl" /><Skeleton className="h-4 w-64 max-w-full rounded-lg" /></div>
      <Skeleton className="h-52 rounded-[22px]" />
      {Array.from({ length: 2 }, (_, k) => (
        <div key={k} className="space-y-2.5">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-[20px]" />)}</div>
        </div>
      ))}
    </Busy>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Busy>
      <Skeleton className="h-10 w-full rounded-2xl" />
      <div className="divide-y divide-border rounded-[20px] bg-surface px-4 shadow-[0_0_0_1px_var(--border)]">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3.5"><Skeleton className="size-8 rounded-xl" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-36 rounded-md" /><Skeleton className="h-3 w-24 rounded-md" /></div><Skeleton className="h-8 w-16 rounded-full" /></div>
        ))}
      </div>
    </Busy>
  );
}

export function ChartsSkeleton({ tiles = 3, charts = 2 }: { tiles?: number; charts?: number }) {
  return (
    <Busy>
      {tiles ? <div className="grid grid-cols-3 gap-2.5">{Array.from({ length: tiles }, (_, i) => <Skeleton key={i} className="h-24 rounded-[20px]" />)}</div> : null}
      {Array.from({ length: charts }, (_, i) => (
        <div key={i} className="space-y-3 rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)]">
          <Skeleton className="h-4 w-32 rounded-md" />
          <div className="flex h-32 items-end gap-1">{Array.from({ length: 16 }, (_, j) => <Skeleton key={j} className="flex-1 rounded-t-md rounded-b-none" />)}</div>
        </div>
      ))}
    </Busy>
  );
}
