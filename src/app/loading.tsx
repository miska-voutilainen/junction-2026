import { SkeletonBlock, SkeletonLine } from "@/components/PageSkeleton";

const ROW_COUNT = 4;

/**
 * Inbox skeleton during client navigation. It draws the shell's frame (top
 * bar and nav at their real sizes, the mobile header below 760 px) so the
 * chrome doesn't blink out while the page loads.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex min-h-screen flex-col bg-surface-bg">
      <div className="hidden h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:block" />
      <div className="h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:hidden" />
      <div className="flex flex-1">
        <aside className="hidden w-nav shrink-0 border-r border-border-subtle bg-surface-raised nav:block" />
        <div className="mx-auto flex w-full max-w-content min-w-0 flex-1 flex-col gap-5 px-4 py-6 compact:px-8 compact:py-7">
          <SkeletonLine className="h-6 w-24" />
          <SkeletonBlock className="h-11" />
          <div className="flex flex-col gap-px overflow-hidden rounded-page border border-border-subtle bg-surface-panel">
            {Array.from({ length: ROW_COUNT }, (_, index) => (
              <SkeletonBlock key={index} className="h-16 rounded-none" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
