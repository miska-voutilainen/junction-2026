/**
 * The one routing decision every screen uses (inbox, shell, dashboard,
 * reviewer, S2): hunk coverage and routing from `route()` plus the trust
 * ladder's levels, with a defined fallback when no report card is readable.
 * Pure functions, no React. Spec section 5.
 */
import type { Area, LadderLevel, Review, ReportCard, TierDecision } from "@/contracts";
import { routingPolicy } from "@/policy/routing";
import { applyEscapes, levelsFromReportCard } from "@/rules/ladder";
import { route } from "@/rules/route";

/**
 * The report card as the server found it; `error` is the validation message when it is unreadable.
 * `source` is "fixture" while no eval has run: its planted bugs are invented and link to nothing.
 */
export type ReportCardInput =
  | { state: "ok"; data: ReportCard; source: "recorded" | "fixture" }
  | { state: "missing" }
  | { state: "unreadable"; error?: string };

/** The notice shown above the list when the report card file fails validation. */
export const REPORT_CARD_UNREADABLE_NOTICE =
  "The report card couldn't be read, so nothing counts as covered and every change is Full. Re-run pnpm evals.";

/** The notice shown above the list when no report card has been recorded. */
export const REPORT_CARD_MISSING_NOTICE =
  "No report card yet, so nothing counts as covered and every change is Full. Run pnpm evals to measure the reviewer.";

/** The line to show above the list when the report card is missing or unreadable, else null. */
export function reportCardNotice(reportCard: ReportCardInput): string | null {
  if (reportCard.state === "unreadable") return REPORT_CARD_UNREADABLE_NOTICE;
  return reportCard.state === "missing" ? REPORT_CARD_MISSING_NOTICE : null;
}

/** Trust level per area for display: the report card (none counts as all Shadow) minus simulated escapes. */
export function inboxLevels(
  reportCard: ReportCardInput,
  escapes: Partial<Record<Area, number>>,
): Record<Area, LadderLevel> {
  return applyEscapes(
    levelsFromReportCard(reportCard.state === "ok" ? reportCard.data : null),
    escapes,
  );
}

/** How a change is routed right now: the decision, the trust levels behind it, and whether the report card was readable. */
export interface ChangeDecision {
  decision: TierDecision;
  levels: Record<Area, LadderLevel>;
  isEvidenceAvailable: boolean;
}

/** Why a change is Full when the report card is missing or unreadable. */
const NO_TRACK_RECORD_REASON: TierDecision["reasons"][number] = {
  ruleId: "R-no-track-record",
  tier: "full",
  text: "No readable report card: nothing counts as covered, so a person reads every hunk.",
};

// route() reasons that quote a hunk count; forcing every hunk to "read" would make them wrong.
const COVERAGE_COUNT_RULES = new Set(["R-read-share", "R-unread", "R-generated"]);

/**
 * The one routing decision every screen uses (inbox, shell, dashboard, reviewer, S2).
 *
 * - Readable report card: `route()` with its levels minus simulated escapes.
 * - Missing or unreadable: without a track record nothing counts as covered, so
 *   the change is Full and every hunk is "Read this". Reasons come from `route()`
 *   with every area at Shadow, minus those that quote a read count, plus
 *   `R-no-track-record`.
 *
 * @param escapes simulated escapes per area; ignored when there is no report card, as every area is already at the bottom
 */
export function decideChange(
  review: Review,
  reportCard: ReportCardInput,
  escapes: Partial<Record<Area, number>>,
): ChangeDecision {
  if (reportCard.state !== "ok") return decisionWithoutReportCard(review);
  const levels = inboxLevels(reportCard, escapes);
  return {
    decision: route(review, levels, routingPolicy, escapes),
    levels,
    isEvidenceAvailable: true,
  };
}

function decisionWithoutReportCard(review: Review): ChangeDecision {
  const levels = levelsFromReportCard(null);
  // No escapes: with every area already at Shadow there is nothing left to demote.
  const shadow = route(review, levels, routingPolicy, {});
  const decision: TierDecision = {
    ...shadow,
    tier: "full",
    reasons: [
      ...shadow.reasons.filter((reason) => !COVERAGE_COUNT_RULES.has(reason.ruleId)),
      NO_TRACK_RECORD_REASON,
    ],
    coverage: Object.fromEntries(review.hunks.map((hunk) => [hunk.id, "read" as const])),
    readHunks: shadow.totalHunks,
    readLines: shadow.totalLines,
    readMinutes: shadow.totalLines > 0 ? shadow.fullMinutes : 0,
  };
  return { decision, levels, isEvidenceAvailable: false };
}
