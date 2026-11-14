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
 * Hunks in a declared legacy zone (policy/legacy.ts) carry an R8 refusal, so
 * no claim or ladder level takes them off the list, and R-legacy names the owner.
 * Touch points (pipeline/legacyTouchPoints.ts) add what R-legacy can't see: R-legacy-guard
 * says per touch what covers it, and a touch with no guard asks for a Full read.
 * Spec section 5, route().
 */
import { areaLabel, ladderLevelLabel } from "../contracts";
import type { Area, Coverage, LadderLevel, Review, Tier, TierDecision } from "../contracts";
import { globToRegExp } from "../policy/globMatch";
import { legacyTouchKindLabel } from "../policy/legacyTouch";
import { legacyTouchFull, legacyZoneOf, legacyZones } from "../policy/legacy";
import { routingPolicy, type RoutingPolicy } from "../policy/routing";

type Hunk = Review["hunks"][number];
type Reason = TierDecision["reasons"][number];

/** The parts of a review route() reads; its routing and receipt draft are what it produces or ignores. */
type RoutedReview = Pick<Review, "files" | "hunks" | "claims" | "findings" | "refusals" | "legacyTouchPoints">;

const tierRank: Record<Tier, number> = { light: 0, focused: 1, full: 2 };

/**
 * Decides how much of a change a human must read, and why.
 * @param review the recorded review (files, hunks, claims, findings, refusals)
 * @param levels trust-ladder level per area, from the report card and any simulated escapes
 * @param policy thresholds; defaults to the committed routing policy
 * @param escapes simulated escapes per area; any area with one or more triggers R-escape
 * @returns the tier, the reasons that set it, each hunk's coverage, and the hunk, line and minute counts of the reading list
 */
export function route(
  review: RoutedReview,
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
  const tier = highestTier(reasons);

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

/** The tier the strictest fired rule asks for; light when none fired. */
function highestTier(reasons: readonly Reason[]): Tier {
  return reasons.reduce<Tier>((highest, reason) => (tierRank[reason.tier] > tierRank[highest] ? reason.tier : highest), "light");
}

/** `word` for a count of one, `manyWord` otherwise: plural(2, "place", "places") is "places". */
function plural(count: number, word: string, manyWord: string): string {
  return count === 1 ? word : manyWord;
}

/** Rule 1. First match wins, so a finding beats a verified claim on the same hunk, and a generated file's hunk needs no claim. */
function coverHunks(
  review: RoutedReview,
  levels: Record<Area, LadderLevel>,
  areaOf: Map<string, Area | null>,
): Record<string, Coverage> {
  const kindOf = new Map(review.files.map((file) => [file.path, file.kind]));
  const flagged = new Set([...review.findings, ...review.refusals].flatMap((flaggedItem) => flaggedItem.hunkIds));
  const coverage: Record<string, Coverage> = {};
  for (const hunk of review.hunks) {
    const area = areaOf.get(hunk.file) ?? null;
    const claims = review.claims.filter((claim) => claim.hunkIds.includes(hunk.id));
    // A finding or refusal still sends a generated hunk to a person: someone flagged it.
    // Generated files have area null (policy/areas.ts), so the Shadow test never
    // catches them and they reach the generated branch below.
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
  const finding = review.findings.find((candidate) => candidate.hunkIds.includes(hunkId));
  if (finding) return `Finding ${finding.id} (${finding.kind}) names this hunk`;
  const refusal = review.refusals.find((candidate) => candidate.hunkIds.includes(hunkId));
  if (refusal?.ruleId === "R8") return `Refusal ${refusal.id} (R8): ${refusal.reason}`;
  if (refusal) return `Refusal ${refusal.id} (${refusal.ruleId}) names this hunk: a person decides`;
  const hunk = review.hunks.find((candidate) => candidate.id === hunkId);
  const area = review.files.find((file) => file.path === hunk?.file)?.area ?? null;
  if (area !== null && levels[area] === "shadow") {
    return `${areaLabel[area]} is at Shadow: the AI's evidence routes nothing here yet`;
  }
  return "No Verified or Supported claim covers it";
}

interface RuleInput {
  review: RoutedReview;
  levels: Record<Area, LadderLevel>;
  policy: RoutingPolicy;
  areaOf: Map<string, Area | null>;
  escapes: Partial<Record<Area, number>>;
  readHunks: number;
  totalHunks: number;
  generatedHunks: number;
}

/** Rules 2 to 11 in the spec's order; each that fires adds one reason (R-escape and R-area-level add one per area). */
function collectReasons(input: RuleInput): Reason[] {
  const { review, policy, readHunks, totalHunks, generatedHunks } = input;
  // Generated hunks are never read, so the share is of the hunks a person could read.
  const readableHunks = totalHunks - generatedHunks;
  const reasons: Reason[] = [];

  reasons.push(...sizeReasons(review, policy));
  reasons.push(...readShareReasons(readHunks, readableHunks, policy));

  reasons.push(...escapeReasons(input));

  const refusals = review.refusals.length;
  if (refusals > 0) {
    reasons.push({ ruleId: "R-refusal", tier: "focused", text: `${refusals} ${plural(refusals, "item", "items")} refused: a human decides` });
  }

  reasons.push(...legacyReasons(review), ...legacyGuardReasons(review));

  const contradictions = review.findings.filter((finding) => finding.kind === "contradiction").length;
  if (contradictions > 0) {
    reasons.push({ ruleId: "R-contradiction", tier: "focused", text: `The PR description contradicts the code in ${contradictions} ${plural(contradictions, "place", "places")}` });
  }

  const defects = review.findings.filter((finding) => finding.kind === "defect").length;
  if (defects > 0) {
    reasons.push({ ruleId: "R-defect", tier: "focused", text: `${defects} ${plural(defects, "defect", "defects")} found` });
  }

  const sensitiveLabels = sensitiveLabelsTouched(review.hunks, policy);
  if (sensitiveLabels.length > 0) {
    reasons.push({ ruleId: "R-sensitive-path", tier: "focused", text: `Touches ${sensitiveLabels.join(", ")}` });
  }

  reasons.push(...areaLevelReasons(input));

  if (readHunks > 0 && reasons.length === 0) {
    reasons.push({ ruleId: "R-unread", tier: "focused", text: `${readHunks} ${plural(readHunks, "hunk has", "hunks have")} no checked evidence` });
  }
  // Last, and at tier light, so it explains the count without raising the tier or hiding R-unread.
  if (generatedHunks > 0) {
    reasons.push({ ruleId: "R-generated", tier: "light", text: generatedReason(generatedHunks) });
  }
  return reasons;
}

/** Rule 2: Full when the change is too big to read closely, not counting generated files. */
function sizeReasons(review: RoutedReview, policy: RoutingPolicy): Reason[] {
  const sizedLines = review.files.filter((file) => file.kind !== "generated").reduce((sum, file) => sum + file.added + file.removed, 0);
  if (sizedLines <= policy.sizeLimit) return [];
  return [{ ruleId: "R-size", tier: "full", text: `${sizedLines} changed lines outside generated files (limit ${policy.sizeLimit})` }];
}

/**
 * Rule R-legacy: one reason per legacy zone the change's hunks touch, naming
 * the owner who decides. Focused, or Full when the change touches legacy code
 * in `legacyTouchFull` hunks or more, counting hunks in a zone and hunks that
 * reach into one from outside (legacy-code touch points): ten reach-ins rework
 * the boundary as much as ten edits inside it.
 * @example "Wire format: edits legacy code in 3 hunks, the runtime owner (the maintainers) decides"
 */
function legacyReasons(review: RoutedReview): Reason[] {
  const touched = legacyZones
    .map((zone) => ({ zone, count: review.hunks.filter((hunk) => legacyZoneOf(hunk.file) === zone).length }))
    .filter(({ count }) => count > 0);
  const zoneHunks = new Set(review.hunks.filter((hunk) => legacyZoneOf(hunk.file) !== null).map((hunk) => hunk.id));
  const reachIns = (review.legacyTouchPoints ?? []).filter((touch) => touch.kind === "legacy-code" && touch.hunkIds.some((id) => !zoneHunks.has(id)));
  const reachInHunks = new Set(reachIns.flatMap((touch) => touch.hunkIds).filter((id) => !zoneHunks.has(id)));
  const total = zoneHunks.size + reachInHunks.size;
  const tier: Tier = total >= legacyTouchFull ? "full" : "focused";
  // Named whenever it lifts the tier, so a Full on "3 hunks" says where the other 2 came from.
  const reaching = reachInHunks.size > 0 && tier === "full" ? `, plus ${reachInHunks.size} reaching in` : "";
  const zoneReasons = touched.map(({ zone, count }): Reason => ({
    ruleId: "R-legacy",
    tier,
    text: `${zone.label}: edits legacy code in ${count} ${plural(count, "hunk", "hunks")}${reaching}, the ${zone.owner} decides`,
  }));
  // Reach-ins alone have no zone reason to carry the Full tier, so they get their own.
  if (zoneReasons.length > 0 || tier !== "full") return zoneReasons;
  const owners = [...new Set(reachIns.map((touch) => touch.owner))].join(" and the ");
  return [{ ruleId: "R-legacy", tier, text: `Legacy code: reaches into the legacy zones from ${reachInHunks.size} hunks, the ${owners} decides` }];
}

/**
 * Rule R-legacy-guard: one reason per touch point, so the owner sees what covers
 * each touch. Unguarded is Full; partly guarded and owner-read are Focused; a
 * guarded touch adds a Light reason so the owner sees the guard. Its R8 refusal,
 * when it has one, still keeps the hunk on the reading list, so the change is at
 * least Focused: a guard tells the owner what covers the touch, it never removes it.
 * @example "Old platform: #if !NETSTANDARD2_0 && !NETFRAMEWORK in 11 hunks, no test runs it on netstandard or .NET Framework: ...; the platform owner (the maintainers) decides" (mp-2297)
 */
function legacyGuardReasons(review: RoutedReview): Reason[] {
  return (review.legacyTouchPoints ?? []).map((touch): Reason => {
    const { status, evidence } = touch.guard;
    // A binary file or a mode change has no hunks; its detail already says so.
    const count = touch.hunkIds.length;
    const inHunks = count === 0 ? "" : ` in ${count} ${plural(count, "hunk", "hunks")}`;
    const where = `${legacyTouchKindLabel[touch.kind]}: ${touch.detail}${inHunks}`;
    // With no hunk there is no R8 to keep the change at Focused, so the guard reason does it.
    const guardedTier: Tier = count === 0 ? "focused" : "light";
    if (status === "guarded") return { ruleId: "R-legacy-guard", tier: guardedTier, text: `${where}, guarded: ${evidence}` };
    const tier: Tier = status === "unguarded" ? "full" : "focused";
    return { ruleId: "R-legacy-guard", tier, text: `${where}, ${evidence}; the ${touch.owner} decides` };
  });
}

/** Rule 3: Full when checked evidence covers so little that the AI saved the reader no effort. */
function readShareReasons(readHunks: number, readableHunks: number, policy: RoutingPolicy): Reason[] {
  if (readableHunks === 0 || readHunks / readableHunks < policy.readShareFull) return [];
  return [{ ruleId: "R-read-share", tier: "full", text: `Read ${readHunks} of ${readableHunks} hunks: most of the change needs a human` }];
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
  return `${generatedHunks} ${plural(generatedHunks, "is a generated snapshot", "are generated snapshots")}: read the template that produces ${plural(generatedHunks, "it", "them")}, because code hidden in a snapshot would not be caught`;
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
