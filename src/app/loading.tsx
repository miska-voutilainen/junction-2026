import { SkeletonBlock, SkeletonLine } from "@/components/PageSkeleton";

const ROW_COUNT = 4;

/** Inbox skeleton during client navigation: the title, the summary bar, then table rows. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-6 compact:px-8 compact:py-7">
      <SkeletonLine className="h-6 w-24" />
      <SkeletonBlock className="h-11" />
      <div className="flex flex-col gap-px overflow-hidden rounded-page border border-border-subtle bg-surface-panel">
        {Array.from({ length: ROW_COUNT }, (_, index) => (
          <SkeletonBlock key={index} className="h-16 rounded-none" />
        ))}
      </div>
    </div>
  );
}

