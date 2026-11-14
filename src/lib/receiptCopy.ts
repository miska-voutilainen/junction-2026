/**
 * The words about a receipt's state that the Review page's Sign step and the
 * full receipt page both show, kept in one place so the two cannot say
 * different things about the same receipt. Spec section 3 (S2, Receipt tab).
 */

/** The receipt states a verify line is written for. "unchecked": valid signature, but no review to compare the diff with. */
export type VerifyLineStatus = "signed" | "unchecked" | "stale" | "unverified";

const VERIFY_LINES: Record<VerifyLineStatus, string> = {
  signed: "Signature valid · diff unchanged",
  unchecked: "Signature valid",
  stale: "The signature is valid, but it covers an older diff.",
  unverified: "The signature check failed when this receipt was exported.",
};

/** The one line under the verify output that says what the output means for this diff. */
export function verifyLine(status: VerifyLineStatus): string {
  return VERIFY_LINES[status];
}

/** Heading of the warning above a receipt for an older diff. */
export const STALE_TITLE = "Stale: the code changed after signing.";

/** What to do about a stale receipt. */
export const STALE_BODY =
  "This receipt no longer covers the diff. Review the new diff, then sign a fresh receipt.";
