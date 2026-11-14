/**
 * Who reads what (idea 5): the reading list grouped by the named role that
 * decides each hunk, so every manual review goes to someone accountable.
 * Mechanical: the roles come from the refusal policy's deciders and the legacy
 * touch points' owners, never from a model. Spec section 3, S2.
 */
import type { Coverage, Review } from "@/contracts";
import { allRefusalRules } from "@/policy/refusalPolicy";
import { legacyZoneOf } from "@/policy/legacy";

/** The role that signs the receipt; it reads whatever no specialist decides. */
export const changeOwnerRole = "change owner (signs the receipt)";

const legacyRuleId = "R8";

/** One role and the hunks it reads. */
export interface ReviewRole {
  role: string;
  hunkIds: string[];
  /** Rule ids with short titles, e.g. "R7 public contract", without repeats. */
  reasons: string[];
}

interface Assignment {
  role: string;
  reason: string;
}

/**
 * Groups the hunks that need a person by the role that reads them.
 * Each hunk goes to exactly one role, first match wins (one hunk, one
 * accountable reader, like the coverage map's first-match rule): an R8 refusal,
 * then any other refusal, then a plain "read" hunk goes to the change owner.
 * Specialist roles come first in order of first appearance, the change owner last.
 * @param coverage route()'s coverage per hunk id.
 */
export function buildReviewRoles(review: Review, coverage: Record<string, Coverage>): ReviewRole[] {
  const roles = new Map<string, ReviewRole>();
  for (const hunk of review.hunks) {
    const assignment = assignHunk(review, hunk.id, hunk.file, coverage[hunk.id]);
    if (!assignment) continue;
    const entry = roles.get(assignment.role) ?? { role: assignment.role, hunkIds: [], reasons: [] };
    entry.hunkIds.push(hunk.id);
    if (!entry.reasons.includes(assignment.reason)) entry.reasons.push(assignment.reason);
    roles.set(assignment.role, entry);
  }
  const specialists = [...roles.values()].filter((entry) => entry.role !== changeOwnerRole);
  const changeOwner = roles.get(changeOwnerRole);
  return changeOwner ? [...specialists, changeOwner] : specialists;
}

function assignHunk(review: Review, hunkId: string, file: string, coverage: Coverage): Assignment | null {
  const refusals = review.refusals.filter((refusal) => refusal.hunkIds.includes(hunkId));
  const legacy = refusals.find((refusal) => refusal.ruleId === legacyRuleId);
  const refusal = legacy ?? refusals[0];
  if (refusal) {
    const rule = allRefusalRules.find((candidate) => candidate.id === refusal.ruleId);
    const role = legacy ? legacyOwner(review, hunkId, file, rule?.decider) : rule?.decider;
    if (role) return { role, reason: reasonOf(refusal.ruleId, rule?.title) };
  }
  return coverage === "read" ? { role: changeOwnerRole, reason: "Needs a person" } : null;
}

/** The touch point's owner, else the zone's, else the rule's own decider. */
function legacyOwner(review: Review, hunkId: string, file: string, ruleDecider = ""): string {
  const touch = review.legacyTouchPoints?.find((point) => point.hunkIds.includes(hunkId));
  return touch?.owner ?? legacyZoneOf(file)?.owner ?? ruleDecider;
}

/** "R7 public contract": the id and the title up to its colon, lower-cased. */
function reasonOf(ruleId: string, title = ""): string {
  const short = title.split(":")[0].trim();
  return short ? `${ruleId} ${short.charAt(0).toLowerCase()}${short.slice(1)}` : ruleId;
}
