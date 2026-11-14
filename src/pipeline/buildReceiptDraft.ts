/**
 * The draft the review carries, for the signed receipt in git: the AI drafts, a person signs. The draft says
 * what a tool checked, what no tool checked (so a person must), and what risk is
 * left because the AI refused to decide it. It claims nothing the review doesn't
 * hold: `acceptedRefusalIds` stays empty until the owner accepts a refusal while
 * signing. Spec section 5, Review contract, and 9.1 T13.
 */
import type { Area, LadderLevel, Review } from "../contracts";
import { coverageReason } from "../rules/route";

type Draft = Review["receiptDraft"];

/**
 * The draft's three blocks, from a review whose routing is already computed.
 * `levels` are the trust-ladder levels the routing used, so each read hunk gets
 * the same reason route() read it for.
 */
export function buildReceiptDraft(
  review: Omit<Review, "receiptDraft">,
  levels: Record<Area, LadderLevel>,
): Draft {
  return {
    checked: checkedItems(review),
    notChecked: [...unreadHunkItems(review, levels), ...unverifiedClaimItems(review)],
    residualRisk: { text: residualRiskText(review.refusals), acceptedRefusalIds: [] },
  };
}

/** Verified claims were checked by a differential test; Supported ones are the AI's own claim with a quote that exists. */
function checkedItems(review: Omit<Review, "receiptDraft">): Draft["checked"] {
  return review.claims.flatMap((claim): Draft["checked"] => {
    if (claim.level === "verified") {
      return [
        {
          item: `${claim.text} (a test fails on the base and passes on the head)`,
          by: "tool" as const,
        },
      ];
    }
    if (claim.level === "supported") {
      return [
        {
          item: `${claim.text} (the quoted code is where the claim says)`,
          by: "ai-supported" as const,
        },
      ];
    }
    return [];
  });
}

/** Hunks no evidence covers: the signer reads these. */
function unreadHunkItems(
  review: Omit<Review, "receiptDraft">,
  levels: Record<Area, LadderLevel>,
): Draft["notChecked"] {
  return review.hunks
    .filter((hunk) => review.routing.coverage[hunk.id] === "read")
    .map((hunk) => ({
      item: `${hunk.file}:${hunk.newStart} (${hunk.id})`,
      reason: coverageReason(review, levels, hunk.id),
    }));
}

function unverifiedClaimItems(review: Omit<Review, "receiptDraft">): Draft["notChecked"] {
  return review.claims
    .filter((claim) => claim.level === "unverified")
    .map((claim) => ({
      item: claim.text,
      reason: "No quote matched the code, so the claim is unverified.",
    }));
}

/** One sentence per refusal, so the signer accepts each knowingly. */
function residualRiskText(refusals: Review["refusals"]): string {
  return refusals
    .map((refusal) => `${refusal.id} (${refusal.ruleId}): ${refusal.reason}`)
    .join(" ");
}
