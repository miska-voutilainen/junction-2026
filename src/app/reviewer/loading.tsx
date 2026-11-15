import { SkeletonBlock, SkeletonLine } from "@/components/PageSkeleton";

const CARD_COUNT = 4;

/**
 * Report card skeleton during client navigation: the shell's frame and a 2x2
 * grid of card placeholders, so the chrome stays and the cards don't jump.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="flex min-h-screen flex-col bg-surface-bg"
    >
      <div className="hidden h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:block" />
      <div className="h-topbar shrink-0 border-b border-border-subtle bg-surface-raised compact:hidden" />
      <div className="flex flex-1">
        <aside className="hidden w-nav shrink-0 border-r border-border-subtle bg-surface-raised nav:block" />
        <div className="mx-auto flex w-full max-w-content min-w-0 flex-1 flex-col gap-5 px-4 py-6 compact:px-8 compact:py-7">
          <SkeletonLine className="h-6 w-56" />
          <SkeletonLine className="w-full max-w-prose" />
          <div className="grid grid-cols-1 gap-4 wide:grid-cols-2">
            {Array.from({ length: CARD_COUNT }, (_, index) => (
              <SkeletonBlock key={index} className="h-56 rounded-page" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
