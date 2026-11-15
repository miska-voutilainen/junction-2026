import { ReviewNextLink } from "@/components/ReviewNextLink";
import type { ReviewedRow } from "./inboxModel";

/**
 * Page title, one line of purpose and the primary action: "Review next" opens
 * the first change that still needs a signature. Hidden when none does. On a
 * phone only the title is read (the mobile header already shows it), since the
 * mobile sections lead with what can be signed there.
 *
 * @param reviewNext The change the button opens, or null when nothing needs review.
 */
export function InboxHeader({ reviewNext }: Readonly<{ reviewNext: ReviewedRow | null }>) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
        <h1 className="sr-only text-2xl font-semibold tracking-tight compact:not-sr-only">Inbox</h1>
        <p className="hidden text-text-muted compact:block">
          Agent changes waiting for a named person to sign.
        </p>
      </div>
      {reviewNext && (
        <ReviewNextLink changeId={reviewNext.id} className="hidden compact:inline-flex" />
      )}
    </div>
  );
}
