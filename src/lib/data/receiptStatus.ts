import type { ReceiptRecord, Review } from "@/contracts";

/** What the receipt badge says about a change: no receipt yet, a receipt for this diff, or one for an older diff. */
export type ReceiptStatusValue = "needs-review" | "signed" | "stale";

/**
 * Compares a receipt with the review it should cover.
 *
 * A receipt is bound to a diff by `diffSha256`; if the change was amended after
 * signing the hashes differ and the signature no longer vouches for what is on
 * screen (spec section 5, ReceiptRecord). Signature validity itself is the
 * receipt CLI's job and is not re-checked here.
 */
export function receiptStatus(review: Review, record: ReceiptRecord | null): ReceiptStatusValue {
  if (record === null) return "needs-review";
  return record.receipt.diffSha256 === review.diff.diffSha256 ? "signed" : "stale";
}
