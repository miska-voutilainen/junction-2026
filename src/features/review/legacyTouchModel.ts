/**
 * Legacy guard on the review page (idea 9): the review's touch points as rows
 * the screen can print. Pure, no React. The touch points themselves come from
 * the pipeline (git and path rules); this only words them. Spec section 3, S2.
 */
import type { LegacyTouchPoint, Review } from "@/contracts";
import { countOf } from "@/lib/countOf";
import { legacyTouchKindLabel } from "@/policy/legacyTouch";

type GuardStatus = LegacyTouchPoint["guard"]["status"];

/** The badge text per guard status; the words carry the meaning, colour only repeats it. */
export const guardStatusLabel: Record<GuardStatus, string> = {
  guarded: "Guarded",
  partly: "Partly guarded",
  unguarded: "Unguarded",
  "owner-read": "Owner reads",
};

/** One touch point, ready to print. */
export interface LegacyTouchRow {
  kind: string;
  detail: string;
  /** "11 hunks" */
  hunks: string;
  owner: string;
  status: GuardStatus;
  statusLabel: string;
  evidence: string;
}

/**
 * The rows of the "Legacy touch points" section, in recorded order.
 * Empty for a review recorded without touch points, which hides the section.
 */
export function buildLegacyTouchRows(review: Review): LegacyTouchRow[] {
  return (review.legacyTouchPoints ?? []).map((touch) => ({
    kind: legacyTouchKindLabel[touch.kind],
    detail: touch.detail,
    hunks: countOf(touch.hunkIds.length, "hunk"),
    owner: touch.owner,
    status: touch.guard.status,
    statusLabel: guardStatusLabel[touch.guard.status],
    evidence: touch.guard.evidence,
  }));
}
