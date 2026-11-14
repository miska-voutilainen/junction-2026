import { MODEL } from "../ai/limits";
import {
  ReviewSchema,
  type ChangeInput,
  type LadderLevel,
  type Area,
  type Requirement,
  type Review,
} from "../contracts";
import { route } from "../rules/route";
import type { LoadedDiff } from "../lib/git";
import type * as a1 from "../prompts/a1";
import type * as a2 from "../prompts/a2";
import { buildReceiptDraft } from "./buildReceiptDraft";
import type { CheckedClaims } from "./quoteCheck";

/** Reviewer version; bumps together with any prompt version (spec section 6). */
export const reviewerVersion = "rv1";

/** Everything the finished review is made of. */
export interface ReviewParts {
  change: ChangeInput;
  requirement: Requirement;
  loadedDiff: LoadedDiff;
  expectation: a1.A1Output | null;
  story: a2.A2Output["story"];
  checkedClaims: CheckedClaims;
  mode: Review["mode"];
  /** Numbered findings from A3 and A4; empty when neither ran. */
  findings: Review["findings"];
  refusals: Review["refusals"];
  /** Versions of the steps that ran; the rest are "none". */
  promptVersions: Review["reviewer"]["promptVersions"];
  run: Review["run"];
  /** Trust level per area from the report card at record time. */
  levels: Record<Area, LadderLevel>;
}

/**
 * Puts the parts together. A step that did not run leaves its part empty and its
 * prompt version "none". The routing is computed on the finished review, so it
 * never disagrees with the claims next to it, and the receipt draft is built
 * last, from that routing: its "not checked" list is the hunks routing says a
 * person reads.
 *
 * @throws if the assembled review breaks the Review contract, which is a bug here.
 */
export function assembleReview(parts: ReviewParts): Review {
  const { change, requirement, loadedDiff, checkedClaims } = parts;
  const unrouted = {
    schemaVersion: 1,
    changeId: change.id,
    requirementId: change.requirementId,
    title: change.title,
    authorAgent: change.authorAgent,
    kind: change.kind,
    mode: parts.mode,
    reviewer: {
      version: reviewerVersion,
      model: MODEL,
      promptVersions: parts.promptVersions,
    },
    run: parts.run,
    diff: loadedDiff.diff,
    files: loadedDiff.files,
    hunks: loadedDiff.hunks,
    requirement,
    expectation: parts.expectation,
    story: parts.story,
    claims: checkedClaims.claims,
    findings: parts.findings,
    refusals: parts.refusals,
    quoteCheck: checkedClaims.quoteCheck,
    retractions: [],
  } satisfies Omit<Review, "routing" | "receiptDraft">;

  const routing = route(
    { ...unrouted, receiptDraft: emptyReceiptDraft, routing: emptyRouting } as Review,
    parts.levels,
  );
  const routed = { ...unrouted, routing };
  return ReviewSchema.parse({ ...routed, receiptDraft: buildReceiptDraft(routed) });
}

const emptyReceiptDraft: Review["receiptDraft"] = {
  checked: [],
  notChecked: [],
  residualRisk: { text: "", acceptedRefusalIds: [] },
};

// route() reads only the review's hunks, claims, findings and refusals; this
// placeholder satisfies the type until the real decision replaces it.
const emptyRouting: Review["routing"] = {
  tier: "light",
  reasons: [],
  coverage: {},
  readHunks: 0,
  totalHunks: 0,
  readLines: 0,
  totalLines: 0,
  readMinutes: 0,
  fullMinutes: 0,
};
