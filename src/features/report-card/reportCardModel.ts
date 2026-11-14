/**
 * The report card as data, ready to draw: one card per area, the lists of what
 * the reviewer missed or got wrong, and the blind-first comparison. Levels
 * come from the planted-bug eval (`levelsFromReportCard`) minus the simulated
 * escapes, never from the AI's own confidence, so a card always says how many
 * known bugs the number rests on. Pure functions, no React. Spec section 3, S3,
 * and section 5, Ladder.
 */
import { AreaSchema, ladderLevelLabel } from "@/contracts";
import type { Area, Citation, LadderLevel, ReportCard, Review } from "@/contracts";
import { ladderPolicy } from "@/policy/ladder";
import { applyEscapes } from "@/rules/ladder";
import type { Escapes } from "@/lib/simulation/escapes";

type ReportCardArea = ReportCard["areas"][number];

/** What one area's card shows, as plain strings and flags. */
export interface AreaCardModel {
  area: Area;
  /** Level after simulated escapes. */
  level: LadderLevel;
  /** "3 of 4 planted bugs caught · planted blind to the prompts", or "No track record". */
  headline: string;
  /** What a change in this area can and cannot get from the AI at this level. */
  effect: string;
  /** What the area needs for the next rung, with the count so far. */
  nextStep: string;
  /** Said where the next step is Trusted and no spot check is recorded for the area. */
  nextStepNote: string | null;
  /** Simulated escapes recorded in this area. */
  escapes: number;
  /** The drop an escape caused ("from Calibrated to Shadow"), or null while none is recorded. */
  escapeDrop: { from: LadderLevel; to: LadderLevel } | null;
  /** "Record escape" is enabled above Shadow only: there is no level below it. */
  canRecordEscape: boolean;
}

const EFFECT: Record<LadderLevel, string> = {
  shadow: "Routes nothing: a person reads every hunk here that no checked evidence covers.",
  calibrated: "May lower a change here to Focused at best, never to Light.",
  trusted: "May lower a change here to Light.",
};

/** Said where Trusted is the next step and the area has no clean spot check: this reference has no way to record one. */
export const NO_SPOT_CHECKS_NOTE = "This reference records no spot checks, so no area can reach Trusted.";

/**
 * Builds one area's card.
 * @param entry the area's row in the report card, or undefined when none was recorded (no track record)
 * @param escapes simulated escapes in this area
 * Example: Calibrated with 1 escape shows Shadow, dropped from Calibrated to Shadow.
 */
export function areaCardModel(area: Area, entry: ReportCardArea | undefined, escapes: number): AreaCardModel {
  const earned = entry?.level ?? "shadow";
  const level = levelAfter(area, earned, escapes);
  const planted = entry?.planted ?? 0;
  const caught = entry?.caught ?? 0;
  const spotChecksClean = entry?.spotChecksClean ?? 0;
  return {
    area,
    level,
    headline: planted > 0 ? `${caught} of ${planted} planted bugs caught · planted blind to the prompts` : "No track record",
    effect: EFFECT[level],
    nextStep: nextStep({ level, earned, planted, caught, spotChecksClean, escapes }),
    nextStepNote: level === "calibrated" && level === earned && spotChecksClean === 0 ? NO_SPOT_CHECKS_NOTE : null,
    escapes,
    escapeDrop: escapeDrop(area, earned, escapes),
    canRecordEscape: level !== "shadow",
  };
}

/** The four cards in order, from the report card (or none) and the escapes. */
export function areaCardModels(reportCard: ReportCard | null, escapes: Escapes): AreaCardModel[] {
  return AreaSchema.options.map((area) =>
    areaCardModel(area, reportCard?.areas.find((entry) => entry.area === area), escapes[area] ?? 0),
  );
}

// The same applyEscapes the inbox routes with, so a card and the routing can never disagree.
function levelAfter(area: Area, earned: LadderLevel, escapes: number): LadderLevel {
  const levels: Record<Area, LadderLevel> = { generator: "shadow", analyzer: "shadow", security: "shadow", performance: "shadow" };
  return applyEscapes({ ...levels, [area]: earned }, { [area]: escapes })[area];
}

/** The latest drop, or null when there is none (no escape, or the area was already at Shadow). */
function escapeDrop(area: Area, earned: LadderLevel, escapes: number): AreaCardModel["escapeDrop"] {
  if (escapes === 0) return null;
  const from = levelAfter(area, earned, escapes - 1);
  const to = levelAfter(area, earned, escapes);
  return from === to ? null : { from, to };
}

function nextStep(input: {
  level: LadderLevel;
  earned: LadderLevel;
  planted: number;
  caught: number;
  spotChecksClean: number;
  escapes: number;
}): string {
  const { level, earned, planted, caught, spotChecksClean, escapes } = input;
  if (level !== earned) {
    const [count, verb, undo] =
      escapes === 1 ? ["1 simulated escape", "holds", "Undo the escape"] : [`${escapes} simulated escapes`, "hold", "Undo the escapes"];
    return `Earned ${ladderLevelLabel[earned]}. ${count} ${verb} it at ${ladderLevelLabel[level]}. ${undo} to restore it.`;
  }
  if (level === "trusted") return "Top level. It holds while no escape is recorded.";
  if (level === "calibrated") {
    return `Trusted needs ${ladderPolicy.spotChecksForTrusted} clean spot checks: ${spotChecksClean} recorded`;
  }
  if (planted < ladderPolicy.minPlanted) {
    return `Calibrated needs ${ladderPolicy.minPlanted} planted bugs: ${planted} so far`;
  }
  const needed = Math.ceil(ladderPolicy.minCatchRate * planted);
  return `Calibrated needs ${needed} of ${planted} planted bugs caught: ${caught} so far`;
}

/** How many planted bugs the report card was measured on, across all areas. */
export function plantedTotal(reportCard: ReportCard): number {
  return reportCard.areas.reduce((sum, entry) => sum + entry.planted, 0);
}

/** The sentence under the title: reviewer version, model and how many bugs the levels rest on. */
export function measuredLine(reportCard: ReportCard): string {
  const planted = plantedTotal(reportCard);
  const { version, model } = reportCard.reviewer;
  return `Reviewer ${version} · ${model} · measured on ${planted} planted bugs, planted by an agent that never saw the prompts`;
}

/** A planted bug the reviewer did not find. */
export interface MissedPlant {
  plantId: string;
  area: Area;
  defect: string;
  variantUrl: string;
}

/** Every plant with `caught: false`, in card order. */
export function missedPlants(reportCard: ReportCard): MissedPlant[] {
  return AreaSchema.options.flatMap((area) =>
    (reportCard.areas.find((entry) => entry.area === area)?.plants ?? [])
      .filter((plant) => !plant.caught)
      .map((plant) => ({ plantId: plant.plantId, area, defect: plant.defect, variantUrl: plant.variantUrl })),
  );
}

/** A recorded review, keyed by the change it belongs to. */
export interface ReviewOfChange {
  changeId: string;
  review: Review;
}

/** A quote the model cited that the mechanical check could not find in the code. */
export interface FailedQuote {
  changeId: string;
  itemId: string;
  /** "src/Foo.cs:12-14", or "src/Foo.cs:437" for one line. */
  location: string;
  /** The text the model claimed is at that location. */
  quote: string;
  reason: string;
}

/**
 * The quote check also strikes a refusal whose rule id is not in the written
 * policy. Those failures are about the id, not a quote, so the lists below
 * keep them apart. They have no citation (there was no code to check); the
 * phrase is matched too, case-insensitively, for failures recorded before
 * the citation became nullable.
 */
function isUnknownRuleFailure(failure: { citation: Citation | null; reason: string }): boolean {
  return failure.citation === null || /unknown rule id/i.test(failure.reason);
}

/** Quotes that failed the check, across the recorded reviews. */
export function failedQuotes(reviews: ReviewOfChange[]): FailedQuote[] {
  return reviews.flatMap(({ changeId, review }) =>
    review.quoteCheck.failures.flatMap(({ itemId, citation, reason }) => {
      if (citation === null || isUnknownRuleFailure({ citation, reason })) return [];
      const location = citation.startLine === citation.endLine ? `${citation.file}:${citation.startLine}` : `${citation.file}:${citation.startLine}-${citation.endLine}`;
      return [{ changeId, itemId, location, quote: citation.quote, reason }];
    }),
  );
}

/** A refusal struck because the rule id it named is not in the refusal policy: the AI invented a rule. */
export interface UnknownRuleRefusal {
  changeId: string;
  /** The quote check's item id for the refusal: "a3-r<n>", the n-th refusal A3 wrote (not the refusal's id in the review). */
  itemId: string;
}

/** Refusals struck for an unknown rule id, across the recorded reviews. */
export function unknownRuleRefusals(reviews: ReviewOfChange[]): UnknownRuleRefusal[] {
  return reviews.flatMap(({ changeId, review }) =>
    review.quoteCheck.failures.filter(isUnknownRuleFailure).map(({ itemId }) => ({ changeId, itemId })),
  );
}

/** The counts the spec words as "Quotes checked: 40 · failed the check: 2 (not posted)". */
export function hallucinationLines(reportCard: ReportCard): string[] {
  const { quotesChecked, quoteFailures, claimsRetracted, findingsDropped } = reportCard.hallucinations;
  return [
    `Quotes checked: ${quotesChecked} · failed the check: ${quoteFailures} (not posted)`,
    `Claims retracted by a failing test: ${claimsRetracted}`,
    `Findings dropped: ${findingsDropped}`,
  ];
}

/** A claim the reviewer withdrew after a test or check contradicted it. */
export interface RetractedClaim {
  changeId: string;
  claimId: string;
  claimText: string;
  reason: string;
}

/** Retractions across the recorded reviews, with the claim's own words. */
export function retractedClaims(reviews: ReviewOfChange[]): RetractedClaim[] {
  return reviews.flatMap(({ changeId, review }) =>
    review.retractions.map(({ claimId, reason }) => ({
      changeId,
      claimId,
      claimText: review.claims.find((claim) => claim.id === claimId)?.text ?? `claim ${claimId} (text not found)`,
      reason,
    })),
  );
}

/** One contradiction plant with how often each mode caught it. */
export interface BlindFirstRow {
  plantId: string;
  statement: string;
  describedFirst: string;
  blindFirst: string;
}

/** The comparison: the overall sentence and one row per planted contradiction. */
export function blindFirstSummary(reportCard: ReportCard): { overall: string; rows: BlindFirstRow[] } {
  const { plants, runsPerMode, anchored, blind, perPlant } = reportCard.anchoredVsBlind;
  return {
    overall:
      `Across ${plants} planted contradictions × ${runsPerMode} runs: given the description first caught ` +
      `${anchored.caught} of ${anchored.total} · blind-first caught ${blind.caught} of ${blind.total}`,
    rows: perPlant.map((plant) => ({
      plantId: plant.plantId,
      statement: plant.statement,
      describedFirst: `${plant.anchoredCaught} of ${plant.runs}`,
      blindFirst: `${plant.blindCaught} of ${plant.runs}`,
    })),
  };
}
