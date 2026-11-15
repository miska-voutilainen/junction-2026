import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One line of placeholder text; `className` sets the width, e.g. "w-1/3". */
export function SkeletonLine({ className }: Readonly<{ className?: string }>) {
  return <Skeleton className={cn("h-4 w-full rounded-chip", className)} />;
}

/** A block-shaped placeholder for a card, table or diff; `className` sets its size. */
export function SkeletonBlock({ className }: Readonly<{ className?: string }>) {
  return <Skeleton className={cn("h-24 w-full rounded-control", className)} />;
}

/** What a page shows while its data loads: a title line and three blocks, announced as "Loading". */
export function PageSkeleton({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn("flex flex-col gap-4", className)}
    >
      <SkeletonLine className="h-6 w-1/3" />
      <SkeletonBlock />
      <SkeletonBlock />
      <SkeletonBlock className="h-40" />
    </div>
  );
}
