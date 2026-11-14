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
import * as a1 from "../prompts/a1";
import * as a2 from "../prompts/a2";
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
  run: Review["run"];
  /** Trust level per area from the report card at record time. */
  levels: Record<Area, LadderLevel>;
}

/**
 * Puts the parts together. Steps that have not run yet (A3 findings and refusals,
 * A4, A5, the receipt draft) are empty and their prompt versions are "none"; T13
 * fills them. The routing is computed on the finished review, so it never
 * disagrees with the claims next to it.
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
    mode: "blind-first",
    reviewer: {
      version: reviewerVersion,
      model: MODEL,
      promptVersions: { a1: a1.version, a2: a2.version, a3: "none", a4: "none", a5: "none" },
    },
    run: parts.run,
    diff: loadedDiff.diff,
    files: loadedDiff.files,
    hunks: loadedDiff.hunks,
    requirement,
    expectation: parts.expectation,
    story: parts.story,
    claims: checkedClaims.claims,
    findings: [],
    refusals: [],
    quoteCheck: checkedClaims.quoteCheck,
    retractions: [],
    receiptDraft: {
      checked: [],
      notChecked: [],
      residualRisk: { text: "", acceptedRefusalIds: [] },
    },
  } satisfies Omit<Review, "routing">;

  const routing = route({ ...unrouted, routing: emptyRouting } as Review, parts.levels);
  return ReviewSchema.parse({ ...unrouted, routing });
}

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
