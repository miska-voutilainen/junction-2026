/**
 * Adds the legacy guard to a review recorded before it existed, without a model
 * call: touch points from git and path rules, R8 refusals appended with the next
 * ids (existing ids never renumber, so receipts and links stay valid), routing
 * and the receipt draft recomputed the way assembleReview does. A review with no
 * touch points comes back with the same fields, so its file does not change.
 * Spec section 5, Policy.
 */
import { ReviewSchema, type Area, type LadderLevel, type Review } from "../contracts";
import { route } from "../rules/route";
import { buildReceiptDraft } from "./buildReceiptDraft";
import { legacyTouchRefusalsFor } from "./checkFindings";
import { findLegacyTouchPoints } from "./legacyTouchPoints";

/**
 * @param levels trust levels route() used at record time (from the report card)
 * @throws if the augmented review breaks the Review contract.
 */
export async function addLegacyGuard(
  review: Review,
  repoDir: string,
  levels: Record<Area, LadderLevel>,
): Promise<Review> {
  const touchPoints = await findLegacyTouchPoints({
    repoDir,
    baseSha: review.diff.baseSha,
    files: review.files,
    hunks: review.hunks,
  });
  if (touchPoints.length === 0 && review.legacyTouchPoints === undefined) return review;

  const added = legacyTouchRefusalsFor(touchPoints, review.refusals).map((refusal, index) => ({
    ...refusal,
    id: `r${review.refusals.length + index + 1}`,
  }));
  const unrouted = {
    ...review,
    legacyTouchPoints: touchPoints,
    refusals: [...review.refusals, ...added],
  };
  const routed = { ...unrouted, routing: route(unrouted, levels) };
  return ReviewSchema.parse({ ...routed, receiptDraft: buildReceiptDraft(routed, levels) });
}
