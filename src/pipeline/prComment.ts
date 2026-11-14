/**
 * The pull request comment: what the reviewer found and what the person must
 * still read, in the words a reviewer needs before opening the diff. It is the
 * CI face of three ideas at once: hunk coverage and routing (the tier and the
 * reading list), evidence levels (how many hunks a check covers) and the signed
 * receipt (whether a named person has signed this exact diff). Pure text from a
 * recorded review, so CI and the tests render the same thing. Spec section 5,
 * CI workflows.
 */
import type { Review } from "../contracts";

/** Hidden marker that lets CI find and update its own comment instead of adding a new one each push. */
export const COMMENT_MARKER = "<!-- countersign -->";

/**
 * What `pnpm countersign verify` reported, by its exit code (spec section 9.1):
 * 0 valid, 1 the diff changed since signing, 2 no receipt, 3 signature invalid.
 */
const RECEIPT_STATUS_BY_EXIT_CODE: Record<number, string> = {
  0: "Signed. The signature verifies and the diff is unchanged since signing.",
  1: "Stale. The diff changed since the receipt was signed; the owner signs again after reading the new diff.",
  2: "Not signed. No receipt for this diff, so the merge gate stays closed until a named person signs.",
  3: "Signature invalid. The receipt does not verify against the allowed signers.",
};

/**
 * Renders the comment for one recorded review.
 *
 * @param receiptExitCode exit code of `pnpm countersign verify <changeId>`; an unknown code reads as not checked.
 * @param measuredModel the model the report card measured, or null with no card; a review by another model
 *   says so, because its tier was routed with no earned trust (`levelsForReviewer`).
 * @returns Markdown that starts with COMMENT_MARKER.
 *
 * @example renderReviewComment(review, 2, review.reviewer.model) // "... Receipt: Not signed. No receipt for this diff ..."
 */
export function renderReviewComment(
  review: Review,
  receiptExitCode: number,
  measuredModel: string | null,
): string {
  const { routing } = review;
  const coverage = countCoverage(routing.coverage);
  const reasons = routing.reasons.map((reason) => `- ${reason.ruleId}: ${reason.text}`);
  const receipt =
    RECEIPT_STATUS_BY_EXIT_CODE[receiptExitCode] ??
    "Not checked. The receipt check did not run, so nothing here says the diff is signed.";

  return [
    COMMENT_MARKER,
    `### Countersign: ${review.changeId} is ${capitalise(routing.tier)}`,
    "",
    `A person reads **${routing.readHunks} of ${routing.totalHunks} hunks** (about ${Math.round(routing.readMinutes)} of ${Math.round(routing.fullMinutes)} minutes). ` +
      `Verified ${coverage.verified}, Supported ${coverage.supported}, Read this ${coverage.read}` +
      (coverage.generated > 0 ? `, generated ${coverage.generated}.` : "."),
    "",
    ...reasons,
    "",
    ...unmeasuredModelLine(review.reviewer.model, measuredModel),
    `**Findings:** ${review.findings.length} · **Refused:** ${review.refusals.length}`,
    `**Receipt:** ${receipt}`,
    "",
    `Reviewer ${review.reviewer.version} (${review.reviewer.model}), ${review.run.usage.calls} model calls, $${review.run.usage.costUsd.toFixed(2)}.`,
  ].join("\n");
}

/**
 * The `--receipt-exit` flag as a number, or NaN when it says nothing. CI passes an empty
 * string when the receipt job stopped before `verify` ran, and `Number("")` is 0, which
 * would read as "Signed" for a diff nobody verified.
 * @example receiptExitFrom("2") // 2
 * @example receiptExitFrom("") // NaN, so the comment says "Not checked"
 */
export function receiptExitFrom(flag: string | undefined): number {
  if (flag === undefined || flag.trim() === "") return Number.NaN;
  return Number(flag);
}

function countCoverage(coverage: Review["routing"]["coverage"]) {
  const counts = { verified: 0, supported: 0, read: 0, generated: 0 };
  for (const state of Object.values(coverage)) counts[state] += 1;
  return counts;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** One line, and a blank after it, when the reviewer is not the model the eval measured; nothing otherwise. */
function unmeasuredModelLine(reviewerModel: string, measuredModel: string | null): string[] {
  if (reviewerModel === measuredModel) return [];
  const measured = measuredModel === null ? "no model" : measuredModel;
  return [
    `**Reviewer not measured:** the report card measured ${measured}; this review ran on ${reviewerModel}, so every area routes as Shadow.`,
    "",
  ];
}
