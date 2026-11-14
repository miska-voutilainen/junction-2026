import { SkeletonBlock, SkeletonLine } from "@/components/PageSkeleton";

/**
 * Review skeleton during client navigation: the shell's frame at its real
 * size, a title line, the dashed "Tier pending" banner (no hunk counts as
 * covered until the evidence is in), then the navigator and diff columns.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex min-h-screen flex-col bg-surface-bg">
      <div className="hidden h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:block" />
      <div className="h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:hidden" />
      <div className="flex flex-1">
        <aside className="hidden w-nav shrink-0 border-r border-border-subtle bg-surface-raised nav:block" />
        <div className="mx-auto flex w-full max-w-content min-w-0 flex-1 flex-col gap-4 px-4 py-6 compact:px-8 compact:py-7">
          <SkeletonLine className="h-6 w-2/3 max-w-md" />
          <div className="rounded-control border border-dashed border-border-default px-4 py-3">
            <p className="text-base font-medium text-text-secondary">Tier pending</p>
            <p className="text-base text-text-muted">No hunk is marked covered until its evidence is in.</p>
          </div>
          <div className="flex items-start gap-6">
            <div className="hidden w-navigator shrink-0 flex-col gap-2 review:flex">
              <SkeletonLine className="h-4 w-24" />
              <SkeletonBlock className="h-8" />
              <SkeletonBlock className="h-8" />
              <SkeletonBlock className="h-8" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <SkeletonLine className="h-4 w-1/3" />
              <SkeletonBlock className="h-64" />
              <SkeletonBlock className="h-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
