import { ReceiptStatus } from "@/components/ReceiptStatus";
import type { ChangeInput, Review } from "@/contracts";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";

const reviewedOn = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The change at a glance: title, ids, who wrote it, the receipt state, and
 * the branch, size and which reviewer recorded the review. Everything the AI
 * wrote or an id is mono; the title and statuses are sans.
 *
 * @param review The recorded review; absent while it is missing or unreadable, so only the change's own facts show.
 */
export function ReviewHeader({
  change,
  review,
  receiptStatus,
  signedBy,
}: {
  change: ChangeInput;
  review?: Review;
  receiptStatus?: ReceiptStatusValue;
  signedBy?: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold text-text-primary">{change.title}</h1>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
        <span className="font-mono text-xs text-text-muted">{change.id}</span>
        <span className="rounded-chip border border-border-default px-1.5 py-0.5 font-mono text-xs text-text-secondary">
          {change.requirementId}
        </span>
        <span className="font-mono text-xs">{change.authorAgent}</span>
        {change.authorDescription.synthetic && (
          <span className="rounded-chip border border-border-default px-1.5 py-0.5 text-xs text-text-muted">
            synthetic PR description
          </span>
        )}
        {receiptStatus && <ReceiptStatus status={receiptStatus} owner={signedBy} />}
      </p>
      {review && <MetaRow change={change} review={review} />}
    </header>
  );
}

function MetaRow({ change, review }: { change: ChangeInput; review: Review }) {
  const { diff, reviewer, run } = review;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-text-muted">
      <span>{change.branch}</span>
      <span>
        +{diff.linesAdded} −{diff.linesRemoved} · {diff.filesChanged} {diff.filesChanged === 1 ? "file" : "files"}
      </span>
      <span>
        Reviewed by {reviewer.version} · {reviewer.model} · {reviewedOn.format(new Date(run.finishedAt))}
      </span>
    </p>
  );
}
