/**
 * The Refused step as data: the refusals with their policy rule and decider,
 * and which of them a signed receipt accepted. Idea 5, refusal policy.
 * Spec section 3, S2 sidebar.
 */
import type { ReceiptRecord, Review } from "@/contracts";
import { allRefusalRules, refusalPolicyVersion } from "@/policy/refusalPolicy";
import { fileName, hunkRange } from "../reviewModel";
import type { SignState } from "./signModel";

/** A place in the diff a button jumps to: "TypeCollector.cs:737–745". */
export interface HunkLocation {
  hunkId: string;
  label: string;
}

/** One refusal with its policy rule, who decides, and whether the signed receipt accepted it. */
export interface RefusalView {
  id: string;
  ruleId: string;
  title: string;
  decider: string;
  reason: string;
  /** "rule": a fixed policy rule raised it with no model involved; "ai": the reviewer did. */
  source: "ai" | "rule";
  locations: HunkLocation[];
  /** The receipt owner when a valid, current receipt accepted this refusal; otherwise null. */
  acceptedBy: string | null;
}

/** Everything the Refused step shows. */
export interface Refusals {
  policyVersion: string;
  ruleCount: number;
  items: RefusalView[];
}

/** The location button of a hunk, or null when the review has no such hunk. */
function locationOf(review: Review, hunkId: string): HunkLocation | null {
  const hunk = review.hunks.find((candidate) => candidate.id === hunkId);
  return hunk ? { hunkId, label: `${fileName(hunk.file)}:${hunkRange(hunk)}` } : null;
}

/** The hunks a finding or refusal names, as location buttons. */
export function locationsOf(review: Review, hunkIds: string[]): HunkLocation[] {
  return hunkIds.flatMap((hunkId) => locationOf(review, hunkId) ?? []);
}

/**
 * The refusals with their rule text from the policy. A refusal counts as
 * accepted only by a receipt that verifies, matches this diff and was signed
 * against this very run: a stale or failed receipt vouches for nothing, and
 * refusal ids ("r1") are numbered per run, so another run's "r2" may be a
 * different refusal. In those cases the decision stays open.
 */
export function buildRefusals(review: Review, record: ReceiptRecord | null, signState: SignState): Refusals {
  const isAcceptanceCurrent = signState === "signed" && record !== null && record.receipt.reviewRunId === review.run.id;
  const accepted = isAcceptanceCurrent ? record.receipt.residualRisk.acceptedRefusalIds : [];
  return {
    policyVersion: refusalPolicyVersion,
    ruleCount: allRefusalRules.length,
    items: review.refusals.map((refusal) => {
      const rule = allRefusalRules.find((candidate) => candidate.id === refusal.ruleId);
      return {
        id: refusal.id,
        ruleId: refusal.ruleId,
        title: rule?.title ?? `Rule not in refusal policy ${refusalPolicyVersion}`,
        decider: rule?.decider ?? "not named in the policy",
        reason: refusal.reason,
        source: refusal.source,
        locations: locationsOf(review, refusal.hunkIds),
        acceptedBy: accepted.includes(refusal.id) && record !== null ? record.receipt.owner : null,
      };
    }),
  };
}

/** The refusals nobody has accepted yet. */
export function openRefusalCount(refusals: Refusals): number {
  return refusals.items.filter((item) => item.acceptedBy === null).length;
}
