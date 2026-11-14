import { ReviewNextLink } from "@/components/ReviewNextLink";
import type { ReviewedRow } from "@/features/inbox";

/**
 * Title, what the page answers, and "Review next" (the same pick as the inbox).
 * The link is hidden when every change is signed.
 */
export function DashboardHeader({ reviewNext }: { reviewNext: ReviewedRow | null }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-text-muted">What signing covered, what it didn&apos;t, and who still has to decide.</p>
      </div>
      {reviewNext && <ReviewNextLink changeId={reviewNext.id} />}
    </div>
  );
}
