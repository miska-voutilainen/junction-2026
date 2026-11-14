/**
 * The Blind check step as data: what the reviewer expected before it saw the
 * diff, the contradictions it found, and the measured effect of reading blind.
 * Idea 2, blind-first review. Spec section 3, S2 sidebar.
 */
import type { Review } from "@/contracts";
import type { ReportCardInput } from "@/lib/decideChange";
import { findingViews } from "./storyModel";
import type { FindingView } from "./storyModel";
import { countOf } from "@/lib/countOf";

/** What the reviewer expected from one requirement item before it saw the diff. */
export interface ExpectedItem {
  itemId: string;
  behaviours: string[];
}

/** How the two reading orders did on this change's planted contradiction. */
export interface ReadingOrderRow {
  statement: string;
  anchoredCaught: number;
  blindCaught: number;
  runs: number;
}

/** Everything the Blind check step shows. */
export interface BlindCheck {
  requirementId: string;
  /** Empty in anchored mode, where nothing was expected before the diff. */
  expected: ExpectedItem[];
  contradictions: FindingView[];
  /** One row for this change's planted contradiction; empty when the report card has none for it. */
  readingOrder: ReadingOrderRow[];
  /** "Across 5 planted contradictions × 3 runs: ...", or null without a readable report card. */
  overallLine: string | null;
  missing: FindingView[];
  scopeCreep: FindingView[];
}

/** The blind-first results for one change: expectations, contradictions and the measured effect of reading blind. */
export function buildBlindCheck(review: Review, reportCard: ReportCardInput): BlindCheck {
  const comparison = reportCard.state === "ok" ? reportCard.data.anchoredVsBlind : null;
  return {
    requirementId: review.requirement.id,
    expected: (review.expectation?.items ?? []).map((item) => ({
      itemId: item.requirementItemId,
      behaviours: item.expectedBehaviours,
    })),
    contradictions: findingViews(review, "contradiction"),
    readingOrder: comparison?.perPlant.filter((plant) => plant.changeId === review.changeId) ?? [],
    overallLine:
      comparison === null
        ? null
        : `Across ${countOf(comparison.plants, "planted contradiction")} × ${comparison.runsPerMode} runs: given the description first caught ${comparison.anchored.caught} of ${comparison.anchored.total} · blind-first caught ${comparison.blind.caught} of ${comparison.blind.total}`,
    missing: findingViews(review, "missing"),
    scopeCreep: findingViews(review, "scope-creep"),
  };
}
