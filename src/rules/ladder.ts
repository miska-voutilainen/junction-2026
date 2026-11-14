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
  escapes: number;
}

/**
 * Level an area has earned, after its escapes.
 * Example: 4 planted, 3 caught, 0 spot checks, 1 escape: Calibrated, then Shadow.
 */
export function ladderLevel(record: AreaRecord, policy: LadderPolicy = ladderPolicy): LadderLevel {
  const { planted, caught, spotChecksClean, escapes } = record;
  const earned = earnedRung(planted, caught, spotChecksClean, policy);
  return rungs[Math.max(0, earned - escapes)];
}

function earnedRung(planted: number, caught: number, spotChecksClean: number, policy: LadderPolicy): number {
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

/** Levels from the recorded report card; with none, no area has a track record, so all are Shadow. */
export function levelsFromReportCard(reportCard: Pick<ReportCard, "areas"> | null): Record<Area, LadderLevel> {
  const levels: Record<Area, LadderLevel> = {
    generator: "shadow",
    analyzer: "shadow",
    security: "shadow",
    performance: "shadow",
  };
  for (const entry of reportCard?.areas ?? []) levels[entry.area] = entry.level;
  return levels;
}
