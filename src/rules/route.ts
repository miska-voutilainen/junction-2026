/**
 * Hunk coverage and routing: turns a review into a reading list. Every hunk
 * gets exactly one state, Verified, Supported or Read this, so a human reads
 * only what no checked evidence covers ("Read 2 of 8 hunks"). The tier is the
 * highest any fired rule asks for. Pure rules, no model call, no I/O, so the
 * routing is explainable line by line and runs in Node and the browser.
 * After a bug escapes in an area, R-escape sends the next changes there back to
 * a full read: the cluster arrest of continuous sampling plans, where a defect
 * that gets through returns inspection to 100% until trust is earned again.
 * Spec section 5, route().
 */
import { areaLabel, ladderLevelLabel } from "../contracts";
import type { Area, Coverage, LadderLevel, Review, Tier, TierDecision } from "../contracts";
import { globToRegExp } from "../policy/globMatch";
import { routingPolicy, type RoutingPolicy } from "../policy/routing";

type Hunk = Review["hunks"][number];
type Reason = TierDecision["reasons"][number];

const tierRank: Record<Tier, number> = { light: 0, focused: 1, full: 2 };

/**
 * Decides how much of a change a human must read, and why.
 * @param review the recorded review (hunks, claims, findings, refusals)
 * @param levels trust-ladder level per area, from the report card and any simulated escapes
 * @param policy thresholds; defaults to the committed routing policy
 * @param escapes simulated escapes per area; any area with one or more triggers R-escape
 */
export function route(
  review: Review,
  levels: Record<Area, LadderLevel>,
  policy: RoutingPolicy = routingPolicy,
  escapes: Partial<Record<Area, number>> = {},
): TierDecision {
  const areaOf = new Map(review.files.map((file) => [file.path, file.area]));
  const coverage = coverHunks(review, levels, areaOf);
  const readHunkList = review.hunks.filter((hunk) => coverage[hunk.id] === "read");

  const totalHunks = review.hunks.length;
  const readHunks = readHunkList.length;
  const totalLines = sumChangedLines(review.hunks);
  const readLines = sumChangedLines(readHunkList);

  const reasons = collectReasons({ review, levels, policy, areaOf, escapes, readHunks, totalHunks });
  const tier = reasons.reduce<Tier>((highest, reason) => (tierRank[reason.tier] > tierRank[highest] ? reason.tier : highest), "light");

  return {
    tier,
    reasons,
    coverage,
    readHunks,
    totalHunks,
    readLines,
    totalLines,
    readMinutes: readLines > 0 ? Math.max(1, Math.ceil(readLines / policy.linesPerMinute)) : 0,
    fullMinutes: Math.ceil(totalLines / policy.linesPerMinute),
  };
}

/** Rule 1. First match wins, so a finding beats a verified claim on the same hunk. */
function coverHunks(
  review: Review,
  levels: Record<Area, LadderLevel>,
  areaOf: Map<string, Area | null>,
): Record<string, Coverage> {
  const flagged = new Set([...review.findings, ...review.refusals].flatMap((item) => item.hunkIds));
  const coverage: Record<string, Coverage> = {};
  for (const hunk of review.hunks) {
    const area = areaOf.get(hunk.file) ?? null;
    const claims = review.claims.filter((claim) => claim.hunkIds.includes(hunk.id));
    if (flagged.has(hunk.id) || (area !== null && levels[area] === "shadow")) coverage[hunk.id] = "read";
    else if (claims.some((claim) => claim.level === "verified")) coverage[hunk.id] = "verified";
    else if (claims.some((claim) => claim.level === "supported")) coverage[hunk.id] = "supported";
    else coverage[hunk.id] = "read";
  }
  return coverage;
}

interface RuleInput {
  review: Review;
  levels: Record<Area, LadderLevel>;
  policy: RoutingPolicy;
  areaOf: Map<string, Area | null>;
  escapes: Partial<Record<Area, number>>;
  readHunks: number;
  totalHunks: number;
}

/** Rules 2 to 10 in the spec's order; each that fires adds one reason (R-escape and R-area-level add one per area). */
function collectReasons(input: RuleInput): Reason[] {
  const { review, policy, readHunks, totalHunks } = input;
  const reasons: Reason[] = [];

  const sizedLines = review.files.filter((file) => file.kind !== "generated").reduce((sum, file) => sum + file.added + file.removed, 0);
  if (sizedLines > policy.sizeLimit) {
    reasons.push({ ruleId: "R-size", tier: "full", text: `${sizedLines} changed lines outside generated files (limit ${policy.sizeLimit})` });
  }

  if (totalHunks > 0 && readHunks / totalHunks >= policy.readShareFull) {
    reasons.push({ ruleId: "R-read-share", tier: "full", text: `Read ${readHunks} of ${totalHunks} hunks: most of the change needs a human` });
  }

  reasons.push(...escapeReasons(input));

  const refusals = review.refusals.length;
  if (refusals > 0) {
    reasons.push({ ruleId: "R-refusal", tier: "focused", text: `${refusals} ${refusals === 1 ? "item" : "items"} refused: a human decides` });
  }

  const contradictions = review.findings.filter((finding) => finding.kind === "contradiction").length;
  if (contradictions > 0) {
    reasons.push({ ruleId: "R-contradiction", tier: "focused", text: `The PR description contradicts the code in ${contradictions} ${contradictions === 1 ? "place" : "places"}` });
  }

  const defects = review.findings.filter((finding) => finding.kind === "defect").length;
  if (defects > 0) {
    reasons.push({ ruleId: "R-defect", tier: "focused", text: `${defects} ${defects === 1 ? "defect" : "defects"} found` });
  }

  const sensitiveLabels = sensitiveLabelsTouched(review.hunks, policy);
  if (sensitiveLabels.length > 0) {
    reasons.push({ ruleId: "R-sensitive-path", tier: "focused", text: `Touches ${sensitiveLabels.join(", ")}` });
  }

  reasons.push(...areaLevelReasons(input));

  if (readHunks > 0 && reasons.length === 0) {
    reasons.push({ ruleId: "R-unread", tier: "focused", text: `${readHunks} ${readHunks === 1 ? "hunk has" : "hunks have"} no checked evidence` });
  }
  return reasons;
}

/** Labels of the sensitive paths any hunk falls in, in policy order. */
function sensitiveLabelsTouched(hunks: Hunk[], policy: RoutingPolicy): string[] {
  return policy.sensitivePaths
    .filter(({ glob }) => {
      const matcher = globToRegExp(glob);
      return hunks.some((hunk) => matcher.test(hunk.file));
    })
    .map(({ label }) => label);
}

/** The areas the change's hunks fall in, in order of first appearance. */
function touchedAreas({ review, areaOf }: RuleInput): Area[] {
  const touched = new Set<Area>();
  for (const hunk of review.hunks) {
    const area = areaOf.get(hunk.file);
    if (area) touched.add(area);
  }
  return [...touched];
}

/** Rule 4: one Full reason per touched area where a bug has escaped. */
function escapeReasons(input: RuleInput): Reason[] {
  return touchedAreas(input)
    .filter((area) => (input.escapes[area] ?? 0) > 0)
    .map((area): Reason => ({
      ruleId: "R-escape",
      tier: "full",
      text: `${areaLabel[area]}: a bug escaped here, the next changes get a full read`,
    }));
}

/** Rule 9: one reason per area the change touches whose level is below Trusted. */
function areaLevelReasons(input: RuleInput): Reason[] {
  const { levels } = input;
  return touchedAreas(input)
    .filter((area) => levels[area] !== "trusted")
    .map((area): Reason => ({
      ruleId: "R-area-level",
      tier: "focused",
      text:
        levels[area] === "shadow"
          ? `${areaLabel[area]}: ${ladderLevelLabel[levels[area]]}, the AI's output routes nothing here`
          : `${areaLabel[area]}: ${ladderLevelLabel[levels[area]]}, may route Focused at best`,
    }));
}

function sumChangedLines(hunks: Hunk[]): number {
  return hunks.reduce((sum, hunk) => sum + hunk.lines.filter((line) => line.kind !== "context").length, 0);
}
