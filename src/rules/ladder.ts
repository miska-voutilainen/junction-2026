/**
 * Trust ladder: an area's level comes from the planted-bug eval, not from the
 * AI's own confidence. Shadow until it catches enough known bugs, Calibrated
 * once it does, Trusted only after clean human spot checks; every escape (a
 * bug that got past review) drops it one rung. Pure, so the browser can
 * re-level instantly when an escape is recorded. Spec section 5, Ladder.
 */
import type { Area, LadderLevel, ReportCard } from "../contracts";
import { ladderPolicy, type LadderPolicy } from "../policy/ladder";

const rungs: LadderLevel[] = ["shadow", "calibrated", "trusted"];
const areas: Area[] = ["generator", "analyzer", "security", "performance"];

/** Track record of one area. */
export interface AreaRecord {
  planted: number;
  caught: number;
  spotChecksClean: number;
}

/**
 * Level an area has earned from its record; `applyEscapes` lowers it after.
 * Example: 4 planted, 3 caught, 0 spot checks: Calibrated.
 */
export function ladderLevel(record: AreaRecord, policy: LadderPolicy = ladderPolicy): LadderLevel {
  const { planted, caught, spotChecksClean } = record;
  return rungs[earnedRung(planted, caught, spotChecksClean, policy)];
}

function earnedRung(
  planted: number,
  caught: number,
  spotChecksClean: number,
  policy: LadderPolicy,
): number {
  if (planted < policy.minPlanted || caught / planted < policy.minCatchRate) return 0;
  return spotChecksClean < policy.spotChecksForTrusted ? 1 : 2;
}

/** Drops each area one level per recorded escape; Shadow stays Shadow. Returns new levels. */
export function applyEscapes(
  levels: Record<Area, LadderLevel>,
  escapes: Partial<Record<Area, number>>,
): Record<Area, LadderLevel> {
  const adjusted = { ...levels };
  for (const area of areas) {
    const dropped = rungs.indexOf(levels[area]) - (escapes[area] ?? 0);
    adjusted[area] = rungs[Math.max(0, dropped)];
  }
  return adjusted;
}

/**
 * Levels a review by `reviewerModel` may route with. A track record belongs to the
 * reviewer that earned it: the report card measured one model on the planted bugs,
 * and another model's catch rate is unknown. Any other model gets no earned trust,
 * so every area is Shadow until that model has its own eval.
 * Example: a card measured on model A, a review by model B: all Shadow.
 *
 * @param reportCard the recorded report card, or null when there is none
 * @param reviewerModel the model that wrote the review being routed (`review.reviewer.model`)
 * @returns the card's levels for the measured model; every area Shadow otherwise
 */
export function levelsForReviewer(
  reportCard: Pick<ReportCard, "areas" | "reviewer"> | null,
  reviewerModel: string,
): Record<Area, LadderLevel> {
  const isMeasured = reportCard !== null && reportCard.reviewer.model === reviewerModel;
  return levelsFromReportCard(isMeasured ? reportCard : null);
}

/** Levels from the recorded report card; with none, no area has a track record, so all are Shadow. */
export function levelsFromReportCard(
  reportCard: Pick<ReportCard, "areas"> | null,
): Record<Area, LadderLevel> {
  const levels: Record<Area, LadderLevel> = {
    generator: "shadow",
    analyzer: "shadow",
    security: "shadow",
    performance: "shadow",
  };
  for (const entry of reportCard?.areas ?? []) levels[entry.area] = entry.level;
  return levels;
}
