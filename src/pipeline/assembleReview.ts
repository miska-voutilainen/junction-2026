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
export const reviewerVersion = "rv2";

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
  /** Claims A5's tests retracted; empty when A5 did not run. */
  retractions?: Review["retractions"];
  /** Tests A5 ran that said nothing, with the reason; omitted when A5 did not run. */
  inconclusiveTests?: Review["inconclusiveTests"];
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
    retractions: parts.retractions ?? [],
    ...(parts.inconclusiveTests ? { inconclusiveTests: parts.inconclusiveTests } : {}),
  } satisfies Omit<Review, "routing" | "receiptDraft">;

  const routing = route(unrouted, parts.levels);
  const routed = { ...unrouted, routing };
  return ReviewSchema.parse({ ...routed, receiptDraft: buildReceiptDraft(routed, parts.levels) });
}
