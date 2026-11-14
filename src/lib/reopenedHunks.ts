/**
 * Signed receipt in git, meeting the trust ladder: the receipt's hunk ledger
 * records which hunks the signer read, and which a check covered instead.
 * When a simulated escape lowers an area's trust, `route()` sends hunks to a
 * person that the signer never had to read. This finds them. Pure, no model
 * call. Spec section 3, S2 and S4 "Reopened by an escape".
 */
import type { Coverage, Receipt } from "@/contracts";

/**
 * The hunks that now need a person but that the signer did not read.
 *
 * A hunk is reopened when the current routing says "read", the routing without
 * escapes did not, and the signed ledger has no reader for it. The baseline keeps
 * hunks that are "read" for another reason (a finding, a missing report card)
 * from being blamed on an escape. Hunks the routing doesn't know are ignored.
 *
 * @param ledger the signed receipt's `hunks`
 * @param currentCoverage `TierDecision.coverage` computed with today's trust levels
 * @param baselineCoverage the same routing with no escapes
 * @returns hunk ids, in ledger order
 */
export function reopenedHunks(
  ledger: Receipt["hunks"],
  currentCoverage: Record<string, Coverage>,
  baselineCoverage: Record<string, Coverage>,
): string[] {
  return ledger
    .filter(
      (entry) =>
        entry.readBy === null &&
        currentCoverage[entry.hunkId] === "read" &&
        baselineCoverage[entry.hunkId] !== "read",
    )
    .map((entry) => entry.hunkId);
}
