import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One line of placeholder text; `className` sets the width, e.g. "w-1/3". */
export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-full rounded-chip", className)} />;
}

/** A block-shaped placeholder for a card, table or diff; `className` sets its size. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("h-24 w-full rounded-control", className)} />;
}
