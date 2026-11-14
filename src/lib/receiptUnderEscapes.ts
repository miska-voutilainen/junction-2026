/**
 * The receipt state once simulated escapes are applied. A signature still holds
 * when an escape lowers an area's trust, but the trust behind it changed: hunks
 * the signer was told a check covered now need a person. `receiptStatus()` stays
 * a pure comparison of receipt and diff; this adds the escape-aware step, once,
 * so the inbox, S2 and S4 agree. Spec section 3, "Reopened by an escape".
 */
import type { Area, ReceiptRecord, Review, TierDecision } from "@/contracts";
import { receiptStatus } from "@/lib/data/receiptStatus";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";
import { reopenedHunks } from "@/lib/reopenedHunks";

/** The receipt badge's values: `receiptStatus()` plus "reopened", which only escapes can cause. */
export type ReceiptState = ReceiptStatusValue | "reopened";

/** The receipt's state and, when reopened, what reopened it. */
export interface ReceiptUnderEscapes {
  status: ReceiptState;
  /** Hunks in an escaped area that the signer did not read and a person now must; empty unless reopened. */
  reopenedHunkIds: string[];
  /** The areas whose escapes reopened it, in order of first appearance in the diff. */
  escapedAreas: Area[];
}

/**
 * "reopened" only when the receipt is otherwise "signed" (verifies, diff unchanged)
 * and an escaped area now sends hunks to a person that the signer did not read.
 * Stale and failed verification outrank it: those say the signature no longer holds.
 *
 * @param decision the routing with the current escapes, from `decideChange`
 * @param escapes simulated escapes per area
 */
export function receiptUnderEscapes(
  review: Review,
  record: ReceiptRecord | null,
  decision: TierDecision,
  escapes: Partial<Record<Area, number>>,
): ReceiptUnderEscapes {
  const status = receiptStatus(review, record);
  const hasEscape = Object.values(escapes).some((count) => count > 0);
  // Without an escape nothing can have been re-routed after signing, whatever the report card says.
  if (status !== "signed" || record === null || !hasEscape) return { status, reopenedHunkIds: [], escapedAreas: [] };

  // Only escaped areas count: a hunk re-routed by anything else is not "an escape" in the copy.
  const areaOfFile = new Map(review.files.map((file) => [file.path, file.area]));
  const areaOfHunk = new Map(review.hunks.map((hunk) => [hunk.id, areaOfFile.get(hunk.file) ?? null]));
  const reopenedHunkIds = reopenedHunks(record.receipt.hunks, decision.coverage).filter((hunkId) => {
    const area = areaOfHunk.get(hunkId);
    return area != null && (escapes[area] ?? 0) > 0;
  });
  if (reopenedHunkIds.length === 0) return { status, reopenedHunkIds, escapedAreas: [] };

  const escapedAreas = [...new Set(reopenedHunkIds.map((hunkId) => areaOfHunk.get(hunkId) as Area))];
  return { status: "reopened", reopenedHunkIds, escapedAreas };
}
