/**
 * Adds the legacy guard to a review recorded before it existed, without a model
 * call: touch points from git and path rules, R8 refusals appended with the next
 * ids (existing ids never renumber, so receipts and links stay valid), routing
 * and the receipt draft recomputed the way assembleReview does. A review with no
 * touch points comes back with the same fields, so its file does not change.
 * Running it again first drops the R8 refusals it added before, so a stale one
 * cannot survive a changed rule.
 * Spec section 5, Policy.
 */
import { ReviewSchema, type Area, type LadderLevel, type Review } from "../contracts";
import { route } from "../rules/route";
import { buildReceiptDraft } from "./buildReceiptDraft";
import { legacyTouchRefusalsFor } from "./checkFindings";
import { findLegacyTouchPoints } from "./legacyTouchPoints";

/**
 * The review with its legacy touch points, their R8 refusals, and routing and
 * the receipt draft recomputed. `pnpm review legacy <changeId>` writes it back.
 * @param repoDir the fork's clone (SAMPLE_REPO_DIR); read at the review's base commit
 * @param levels the current report card's trust levels: routing is recomputed
 *   with today's ladder, not the one at record time
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

  // R8 is rule-made (the model may not raise it) and always appended after the
  // others, so dropping and re-adding R8 never renumbers another refusal.
  const kept = review.refusals.filter((refusal) => refusal.ruleId !== "R8");
  const added = legacyTouchRefusalsFor(touchPoints, kept).map((refusal, index) => ({
    ...refusal,
    id: `r${kept.length + index + 1}`,
  }));
  const unrouted = { ...review, legacyTouchPoints: touchPoints, refusals: [...kept, ...added] };
  const routed = { ...unrouted, routing: route(unrouted, levels) };
  return ReviewSchema.parse({ ...routed, receiptDraft: buildReceiptDraft(routed, levels) });
}
