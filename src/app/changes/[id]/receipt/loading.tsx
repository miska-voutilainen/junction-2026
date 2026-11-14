import { SkeletonBlock, SkeletonLine } from "@/components/PageSkeleton";

/**
 * Receipt skeleton during client navigation: the shell's frame at its real
 * sizes (as in the inbox skeleton) and a card with the receipt's rhythm, a
 * title, the identity block and three sections.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex min-h-screen flex-col bg-surface-bg">
      <div className="hidden h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:block" />
      <div className="h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:hidden" />
      <div className="flex flex-1">
        <aside className="hidden w-nav shrink-0 border-r border-border-subtle bg-surface-raised nav:block" />
        <div className="mx-auto flex w-full max-w-prose min-w-0 flex-1 flex-col gap-5 px-4 py-6 compact:px-7 compact:py-10">
          <SkeletonLine className="h-6 w-40" />
          <div className="flex flex-col gap-6 rounded-page border border-border-default bg-surface-code p-5 compact:p-10">
            <SkeletonLine className="h-8 w-3/4" />
            <SkeletonBlock className="h-28" />
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
