import type { ReceiptRecord, Review } from "@/contracts";

/**
 * What the receipt badge says about a change: no receipt yet, a receipt whose
 * recorded signature check failed, a receipt for this diff, or one for an older diff.
 */
export type ReceiptStatusValue = "needs-review" | "unverified" | "signed" | "stale";

/**
 * Compares a receipt with the review it should cover.
 *
 * A receipt is bound to a diff by `diffSha256`; if the change was amended after
 * signing the hashes differ and the signature no longer vouches for what is on
 * screen (spec section 5, ReceiptRecord). Signature validity itself is the
 * receipt CLI's job: this reads the outcome it recorded in `verify.ok` and does not re-check it.
 */
export function receiptStatus(review: Review, record: ReceiptRecord | null): ReceiptStatusValue {
  if (record === null) return "needs-review";
  // A failed check outranks the diff comparison: a signature that does not verify vouches for nothing.
  if (!record.verify.ok) return "unverified";
  return record.receipt.diffSha256 === review.diff.diffSha256 ? "signed" : "stale";
}
