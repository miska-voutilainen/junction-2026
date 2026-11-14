/**
 * Hunk coverage and routing: turns a review into a reading list. Every hunk
 * gets exactly one state, Verified, Supported, Read this or Generated, so a
 * human reads only what no checked evidence covers ("Read 2 of 8 hunks").
 * Hunks in generated files (snapshots) stay visible as Generated but leave the
 * reading count, so a change made of 400 snapshots doesn't drown its 12 real
 * hunks; R-generated says the risk in one line. The tier is the highest any
 * fired rule asks for. Pure rules, no model call, no I/O, so the
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
  const generatedHunks = countGenerated(coverage);
  const readHunks = readHunkList.length;
  const totalLines = sumChangedLines(review.hunks);
  const readLines = sumChangedLines(readHunkList);

  const reasons = collectReasons({ review, levels, policy, areaOf, escapes, readHunks, totalHunks, generatedHunks });
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

/** Rule 1. First match wins, so a finding beats a verified claim on the same hunk, and a generated file's hunk needs no claim. */
function coverHunks(
  review: Review,
  levels: Record<Area, LadderLevel>,
  areaOf: Map<string, Area | null>,
): Record<string, Coverage> {
  const kindOf = new Map(review.files.map((file) => [file.path, file.kind]));
  const flagged = new Set([...review.findings, ...review.refusals].flatMap((item) => item.hunkIds));
  const coverage: Record<string, Coverage> = {};
  for (const hunk of review.hunks) {
    const area = areaOf.get(hunk.file) ?? null;
    const claims = review.claims.filter((claim) => claim.hunkIds.includes(hunk.id));
    // A finding or refusal still sends a generated hunk to a person: someone flagged it.
    if (flagged.has(hunk.id) || (area !== null && levels[area] === "shadow")) coverage[hunk.id] = "read";
    else if (kindOf.get(hunk.file) === "generated") coverage[hunk.id] = "generated";
    else if (claims.some((claim) => claim.level === "verified")) coverage[hunk.id] = "verified";
    else if (claims.some((claim) => claim.level === "supported")) coverage[hunk.id] = "supported";
    else coverage[hunk.id] = "read";
  }
  return coverage;
}

/**
 * Why a hunk is in the reading list, in the order coverHunks applies its rule:
 * a finding, then a refusal, then a Shadow area, else no claim covers it. Only
 * meaningful for hunks whose coverage is "read".
 * @example "Finding f1 (defect) names this hunk"
 */
export function coverageReason(
  review: Omit<Review, "receiptDraft">,
  levels: Record<Area, LadderLevel>,
  hunkId: string,
): string {
  const finding = review.findings.find((item) => item.hunkIds.includes(hunkId));
  if (finding) return `Finding ${finding.id} (${finding.kind}) names this hunk`;
  const refusal = review.refusals.find((item) => item.hunkIds.includes(hunkId));
  if (refusal) return `Refusal ${refusal.id} (${refusal.ruleId}) names this hunk: a person decides`;
  const hunk = review.hunks.find((item) => item.id === hunkId);
  const area = review.files.find((file) => file.path === hunk?.file)?.area ?? null;
  if (area !== null && levels[area] === "shadow") {
    return `${areaLabel[area]} is at Shadow: the AI's evidence routes nothing here yet`;
  }
  return "No Verified or Supported claim covers it";
}

interface RuleInput {
  review: Review;
  levels: Record<Area, LadderLevel>;
  policy: RoutingPolicy;
  areaOf: Map<string, Area | null>;
  escapes: Partial<Record<Area, number>>;
  readHunks: number;
  totalHunks: number;
  generatedHunks: number;
}

/** Rules 2 to 10 in the spec's order; each that fires adds one reason (R-escape and R-area-level add one per area). */
function collectReasons(input: RuleInput): Reason[] {
  const { review, policy, readHunks, totalHunks, generatedHunks } = input;
  // Generated hunks are never read, so the share is of the hunks a person could read.
  const readableHunks = totalHunks - generatedHunks;
  const reasons: Reason[] = [];

  const sizedLines = review.files.filter((file) => file.kind !== "generated").reduce((sum, file) => sum + file.added + file.removed, 0);
  if (sizedLines > policy.sizeLimit) {
    reasons.push({ ruleId: "R-size", tier: "full", text: `${sizedLines} changed lines outside generated files (limit ${policy.sizeLimit})` });
  }

  if (readableHunks > 0 && readHunks / readableHunks >= policy.readShareFull) {
    reasons.push({ ruleId: "R-read-share", tier: "full", text: `Read ${readHunks} of ${readableHunks} hunks: most of the change needs a human` });
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
  // Last, and at tier light, so it explains the count without raising the tier or hiding R-unread.
  if (generatedHunks > 0) {
    reasons.push({ ruleId: "R-generated", tier: "light", text: generatedReason(generatedHunks) });
  }
  return reasons;
}

/** How many hunks route() marked "generated": the ones the reading count leaves out. */
export function countGenerated(coverage: Record<string, Coverage> | Coverage[]): number {
  return Object.values(coverage).filter((state) => state === "generated").length;
}

/**
 * The one-line note on a change with generated hunks: the count, what to read
 * instead, and the risk of not reading them.
 * @example "411 are generated snapshots: read the template that produces them, because code hidden in a snapshot would not be caught"
 */
export function generatedReason(generatedHunks: number): string {
  return `${generatedHunks} ${generatedHunks === 1 ? "is a generated snapshot" : "are generated snapshots"}: read the template that produces ${generatedHunks === 1 ? "it" : "them"}, because code hidden in a snapshot would not be caught`;
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
