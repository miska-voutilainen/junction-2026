import Link from "next/link";
import { ReceiptStatus } from "@/components/ReceiptStatus";
import { SyntheticTag } from "@/components/SyntheticTag";
import type { ChangeInput, Review } from "@/contracts";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";
import { SignButton } from "./steps/SignButton";

const reviewedOn = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The change at a glance: title, ids, who wrote it, the receipt state, and
 * the branch, size and which reviewer recorded the review. Everything the AI
 * wrote is mono: ids, the branch, the model. Prose and statuses are sans.
 *
 * @param receiptHref Where the full receipt page is; set whenever a receipt file exists, whatever its status.
 * @param isReceiptUnreadable The receipt file exists but fails validation, so there is nothing to sign against.
 * @param review The recorded review; absent while it is missing or unreadable, so only the change's own facts show.
 */
export function ReviewHeader({
  change,
  review,
  receiptStatus,
  signedBy,
  receiptHref,
  isReceiptUnreadable = false,
}: {
  change: ChangeInput;
  review?: Review;
  receiptStatus?: ReceiptStatusValue;
  signedBy?: string;
  receiptHref?: string;
  isReceiptUnreadable?: boolean;
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-balance text-text-primary [overflow-wrap:anywhere]">{change.title}</h1>
        {receiptStatus && <SignButton signState={isReceiptUnreadable ? "unreadable" : receiptStatus} />}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
        <span className="font-mono text-xs text-text-muted [overflow-wrap:anywhere]">{change.id}</span>
        <span className="rounded-chip border border-border-default px-1.5 py-0.5 font-mono text-xs text-text-secondary">
          {change.requirementId}
        </span>
        <span className="[overflow-wrap:anywhere]">{change.authorAgent}</span>
        {change.authorDescription.synthetic && <SyntheticTag />}
        {receiptStatus && <ReceiptStatus status={receiptStatus} owner={signedBy} />}
        {receiptHref && (
          <Link href={receiptHref} className="rounded-item text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
            View full receipt
          </Link>
        )}
      </p>
      {review && <MetaRow change={change} review={review} />}
    </header>
  );
}

function MetaRow({ change, review }: { change: ChangeInput; review: Review }) {
  const { diff, reviewer, run } = review;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
      <span className="font-mono [overflow-wrap:anywhere]">{change.branch}</span>
      <span>
        <span className="font-mono">
          +{diff.linesAdded} −{diff.linesRemoved}
        </span>{" "}
        · {diff.filesChanged} {diff.filesChanged === 1 ? "file" : "files"}
      </span>
      <span>
        Reviewed by <span className="font-mono">{reviewer.version}</span> · <span className="font-mono [overflow-wrap:anywhere]">{reviewer.model}</span> ·{" "}
        {reviewedOn.format(new Date(run.finishedAt))}
      </span>
    </p>
  );
}
