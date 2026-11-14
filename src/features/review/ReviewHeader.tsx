import Link from "next/link";
import { ReceiptStatus } from "@/components/ReceiptStatus";
import { RolesLine } from "@/components/RolesLine";
import { SyntheticTag } from "@/components/SyntheticTag";
import type { ChangeInput, Review } from "@/contracts";
import type { SignerState } from "@/lib/data/receiptStatus";
import type { ReceiptState } from "@/lib/receiptUnderEscapes";
import { SignButton } from "./steps/SignButton";
import type { SignState } from "./steps/signModel";
import { countOf } from "@/lib/countOf";

const reviewedOn = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The change at a glance: title, ids, the receipt state when it needs action (stale, failed verification, reopened by an escape),
 * and the branch, size, the roles line (who wrote, reviewed and signed) and the
 * model and date of the review. Everything the AI
 * wrote is mono: ids, the branch, the model. Prose and statuses are sans.
 *
 * @param signer Who signed, for the roles line: a verified receipt's owner, or why nobody is named.
 * @param receiptHref Where the full receipt page is; set whenever a receipt file exists, whatever its status.
 * @param isReceiptUnreadable The receipt file exists but fails validation, so there is nothing to sign against.
 * @param review The recorded review; absent while it is missing or unreadable, so only the change's own facts show.
 */
export function ReviewHeader({
  change,
  review,
  receiptStatus,
  signer,
  receiptHref,
  isReceiptUnreadable = false,
}: Readonly<{
  change: ChangeInput;
  review?: Review;
  receiptStatus?: ReceiptState;
  signer: SignerState;
  receiptHref?: string;
  isReceiptUnreadable?: boolean;
}>) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-balance [overflow-wrap:anywhere] text-text-primary">
          {change.title}
        </h1>
        {receiptStatus && <SignButton signState={isReceiptUnreadable ? "unreadable" : signStateOf(receiptStatus)} />}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
        <span className="rounded-chip border border-border-default px-1.5 py-0.5 text-xs text-text-secondary">
          Requirement <span className="font-mono">{change.requirementId}</span>
        </span>
        {change.authorDescription.synthetic && <SyntheticTag />}
        {/* "Signed by" lives in the roles line below; this keeps only the states that ask for action. */}
        {(receiptStatus === "stale" ||
          receiptStatus === "unverified" ||
          receiptStatus === "reopened") && <ReceiptStatus status={receiptStatus} />}
        {receiptHref && (
          <Link
            href={receiptHref}
            className="rounded-item text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            View full receipt
          </Link>
        )}
      </p>
      {review && <MetaRow change={change} review={review} />}
      {/* Without a readable review there is no reviewer to name, but the author and signer still show. */}
      <div className="text-xs text-text-muted">
        <RolesLine
          authorAgent={change.authorAgent}
          reviewerVersion={review?.reviewer.version ?? null}
          signer={signer}
        />
      </div>
    </header>
  );
}

function MetaRow({ change, review }: Readonly<{ change: ChangeInput; review: Review }>) {
  const { diff, reviewer, run } = review;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
      <span className="font-mono [overflow-wrap:anywhere]">{change.branch}</span>
      <span>
        <span className="font-mono">
          +{diff.linesAdded} −{diff.linesRemoved}
        </span>{" "}
        · {countOf(diff.filesChanged, "file")}
      </span>
      <span>
        <span className="font-mono [overflow-wrap:anywhere]">{reviewer.model}</span> ·{" "}
        {reviewedOn.format(new Date(run.finishedAt))}
      </span>
    </p>
  );
}

/** A reopened receipt is still signed: the signature holds, only the trust behind it changed. */
function signStateOf(status: ReceiptState): SignState {
  return status === "reopened" ? "signed" : status;
}
