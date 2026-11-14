import { SkeletonBlock, SkeletonLine } from "@/components/PageSkeleton";

const FACT_COUNT = 5;
const CARD_COUNT = 2;

/**
 * Dashboard skeleton during client navigation: the shell's frame at its real
 * sizes, then five fact tiles and the two cards (accepted risk, attention by
 * tier) the page opens with.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex min-h-screen flex-col bg-surface-bg">
      <div className="hidden h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:block" />
      <div className="h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:hidden" />
      <div className="flex flex-1">
        <aside className="hidden w-nav shrink-0 border-r border-border-subtle bg-surface-raised nav:block" />
        <div className="mx-auto flex w-full max-w-content min-w-0 flex-1 flex-col gap-6 px-4 py-6 compact:gap-8 compact:px-8 compact:py-7">
          <SkeletonLine className="h-7 w-36" />
          <div className="grid grid-cols-2 gap-3 compact:grid-cols-5">
            {Array.from({ length: FACT_COUNT }, (_, index) => (
              <SkeletonBlock key={index} className="h-20" />
            ))}
          </div>
          {Array.from({ length: CARD_COUNT }, (_, index) => (
            <SkeletonBlock key={index} className="h-48" />
          ))}
        </div>
      </div>
    </div>
  );
}
