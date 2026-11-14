/**
 * The inbox as data: one row per change, sorted and counted, ready to draw.
 * Tiers and reading estimates come from `route()` run here with the current
 * trust levels, so a simulated escape re-routes the inbox without a reload
 * (spec section 3, S1 "Live re-routing"). Pure functions, no React.
 */
import type { ShellChange } from "@/components/ShellChange";
import { tierLabel } from "@/contracts";
import type { Area, ChangeInput, Coverage, LadderLevel, ReceiptRecord, ReportCard, Review, Tier, TierDecision } from "@/contracts";
import { receiptStatus } from "@/lib/data/receiptStatus";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";
import { applyEscapes, levelsFromReportCard } from "@/rules/ladder";
import { route } from "@/rules/route";
import { routingPolicy } from "@/policy/routing";

/** What the server hands over for one change: its input, the state of its review, and its receipt if any. */
export interface InboxSource {
  change: ChangeInput;
  review: { state: "ok"; data: Review } | { state: "missing" } | { state: "unreadable" };
  /** "unreadable": a receipt file exists but fails validation. */
  receipt: ReceiptRecord | "unreadable" | null;
}

/**
 * The report card as the server found it; `error` is the validation message when it is unreadable.
 * `source` is "fixture" while no eval has run: its planted bugs are invented and link to nothing.
 */
export type ReportCardInput =
  | { state: "ok"; data: ReportCard; source: "recorded" | "fixture" }
  | { state: "missing" }
  | { state: "unreadable"; error?: string };

/** The notice shown above the list when the report card file fails validation. */
export const REPORT_CARD_NOTICE =
  "The report card couldn't be read, so nothing counts as covered and every change is Full. Re-run pnpm evals.";

/** The notice shown above the list when no report card has been recorded. */
export const REPORT_CARD_MISSING_NOTICE =
  "No report card yet, so nothing counts as covered and every change is Full. Run pnpm evals to measure the reviewer.";

/** The line to show above the list when the report card is missing or unreadable, else null. */
export function reportCardNotice(reportCard: ReportCardInput): string | null {
  if (reportCard.state === "unreadable") return REPORT_CARD_NOTICE;
  return reportCard.state === "missing" ? REPORT_CARD_MISSING_NOTICE : null;
}

/** Trust level per area for display: the report card (none counts as all Shadow) minus simulated escapes. */
export function inboxLevels(reportCard: ReportCardInput, escapes: Partial<Record<Area, number>>): Record<Area, LadderLevel> {
  return applyEscapes(levelsFromReportCard(reportCard.state === "ok" ? reportCard.data : null), escapes);
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
export function decideChange(review: Review, reportCard: ReportCardInput, escapes: Partial<Record<Area, number>>): ChangeDecision {
  if (reportCard.state !== "ok") return decisionWithoutReportCard(review);
  const levels = applyEscapes(levelsFromReportCard(reportCard.data), escapes);
  return { decision: route(review, levels, routingPolicy, escapes), levels, isEvidenceAvailable: true };
}

function decisionWithoutReportCard(review: Review): ChangeDecision {
  const levels = levelsFromReportCard(null);
  const shadow = route(review, levels);
  const decision: TierDecision = {
    ...shadow,
    tier: "full",
    reasons: [...shadow.reasons.filter((reason) => !COVERAGE_COUNT_RULES.has(reason.ruleId)), NO_TRACK_RECORD_REASON],
    coverage: Object.fromEntries(review.hunks.map((hunk) => [hunk.id, "read" as const])),
    readHunks: shadow.totalHunks,
    readLines: shadow.totalLines,
    readMinutes: shadow.totalLines > 0 ? shadow.fullMinutes : 0,
  };
  return { decision, levels, isEvidenceAvailable: false };
}

interface RowBase {
  id: string;
  title: string;
  requirementId: string;
  authorAgent: string;
  hasSyntheticDescription: boolean;
}

/** A change with a readable review, routed. */
export interface ReviewedRow extends RowBase {
  state: "reviewed";
  tier: Tier;
  readHunks: number;
  totalHunks: number;
  readMinutes: number;
  fullMinutes: number;
  /** One entry per hunk in diff order, for the coverage strip. */
  coverage: Coverage[];
  contradictions: number;
  refusals: number;
  receipt: ReceiptStatusValue;
  /** The receipt file exists but could not be read; `receipt` then says "needs-review". */
  isReceiptUnreadable: boolean;
  /** GitHub login of the signer; set only when `receipt` is "signed". */
  signedBy?: string;
}

/** A change whose review is missing or fails validation; shown as a title and a one-line reason. */
export interface UnreviewedRow extends RowBase {
  state: "missing" | "unreadable";
}

/** One line of the inbox: a routed change, or one whose review is missing or unreadable. */
export type InboxRow = ReviewedRow | UnreviewedRow;

/** The status filter above the list; "needs-review" and "stale" match the receipt status. */
export type StatusFilter = "all" | "needs-review" | "stale" | "signed";

/** Totals for the summary bar; hunks and minutes count reviewed changes only. */
export interface InboxSummary {
  changes: number;
  tierCounts: Record<Tier, number>;
  signed: number;
  readHunks: number;
  totalHunks: number;
  readMinutes: number;
  fullMinutes: number;
}

/** Everything the inbox draws: sorted rows, the summary, and the change "Review next" opens. */
export interface InboxModel {
  /** Sorted: Full, Focused, Light, then unreviewed; ties by id. */
  rows: InboxRow[];
  summary: InboxSummary;
  /** The first row in inbox order that has a review and no valid receipt, or null. */
  reviewNext: ReviewedRow | null;
}

const TIER_ORDER: Record<Tier, number> = { full: 0, focused: 1, light: 2 };
const UNREVIEWED_ORDER = 3;

/**
 * Routes every change with `levels` and builds the sorted rows and summary.
 *
 * @param escapes simulated escapes per area; see `decideChange`
 */
export function buildInboxModel(sources: InboxSource[], reportCard: ReportCardInput, escapes: Partial<Record<Area, number>>): InboxModel {
  const rows = sources.map((source) => buildRow(source, reportCard, escapes)).sort(compareRows);
  return {
    rows,
    summary: summarise(rows),
    reviewNext: rows.filter(isReviewed).find((row) => row.receipt !== "signed") ?? null,
  };
}

/** Type guard: the row has a review and so a tier. */
export function isReviewed(row: InboxRow): row is ReviewedRow {
  return row.state === "reviewed";
}

/** Rows that match the status filter. Unreviewed rows appear only under "all": they have no receipt status. */
export function filterRows(rows: InboxRow[], filter: StatusFilter): InboxRow[] {
  if (filter === "all") return rows;
  const wanted: ReceiptStatusValue = filter === "stale" ? "stale" : filter === "signed" ? "signed" : "needs-review";
  // A receipt that failed verification still needs a person: it sits under "Needs review", not "Signed".
  return rows.filter((row) => isReviewed(row) && (row.receipt === wanted || (wanted === "needs-review" && row.receipt === "unverified")));
}

/** How many rows each filter shows, for the counts on the filter buttons. */
export function filterCounts(rows: InboxRow[]): Record<StatusFilter, number> {
  return {
    all: rows.length,
    "needs-review": filterRows(rows, "needs-review").length,
    stale: filterRows(rows, "stale").length,
    signed: filterRows(rows, "signed").length,
  };
}

/** The mobile inbox's three groups: what a phone can sign, what needs a desktop, and what is done. */
export interface MobileSections {
  signHere: ReviewedRow[];
  needsDesktop: InboxRow[];
  signed: ReviewedRow[];
}

/**
 * Light changes and stale signatures can be handled on a phone; Focused and
 * Full changes need the reading a desktop gives. Stale and unverified win over the tier:
 * a signature that no longer holds is always asking for action.
 */
export function mobileSections(rows: InboxRow[]): MobileSections {
  const sections: MobileSections = { signHere: [], needsDesktop: [], signed: [] };
  for (const row of rows) {
    if (!isReviewed(row)) sections.needsDesktop.push(row);
    else if (row.receipt === "signed") sections.signed.push(row);
    else if (row.receipt === "stale" || row.receipt === "unverified" || row.tier === "light") sections.signHere.push(row);
    else sections.needsDesktop.push(row);
  }
  return sections;
}

function buildRow({ change, review, receipt }: InboxSource, reportCard: ReportCardInput, escapes: Partial<Record<Area, number>>): InboxRow {
  const base: RowBase = {
    id: change.id,
    title: change.title,
    requirementId: change.requirementId,
    authorAgent: change.authorAgent,
    hasSyntheticDescription: change.authorDescription.synthetic,
  };
  if (review.state !== "ok") return { ...base, state: review.state };

  const { decision } = decideChange(review.data, reportCard, escapes);
  const isReceiptUnreadable = receipt === "unreadable";
  const record = isReceiptUnreadable ? null : receipt;
  const status = receiptStatus(review.data, record);
  return {
    ...base,
    state: "reviewed",
    tier: decision.tier,
    readHunks: decision.readHunks,
    totalHunks: decision.totalHunks,
    readMinutes: decision.readMinutes,
    fullMinutes: decision.fullMinutes,
    coverage: review.data.hunks.map((hunk) => decision.coverage[hunk.id]),
    contradictions: review.data.findings.filter((finding) => finding.kind === "contradiction").length,
    refusals: review.data.refusals.length,
    receipt: status,
    isReceiptUnreadable,
    signedBy: status === "signed" ? record?.receipt.owner : undefined,
  };
}

function compareRows(a: InboxRow, b: InboxRow): number {
  const byTier = tierOrder(a) - tierOrder(b);
  return byTier !== 0 ? byTier : a.id.localeCompare(b.id);
}

function tierOrder(row: InboxRow): number {
  return isReviewed(row) ? TIER_ORDER[row.tier] : UNREVIEWED_ORDER;
}

function summarise(rows: InboxRow[]): InboxSummary {
  const reviewed = rows.filter(isReviewed);
  const sum = (pick: (row: ReviewedRow) => number) => reviewed.reduce((total, row) => total + pick(row), 0);
  const countTier = (tier: Tier) => reviewed.filter((row) => row.tier === tier).length;
  return {
    changes: rows.length,
    tierCounts: { light: countTier("light"), focused: countTier("focused"), full: countTier("full") },
    signed: reviewed.filter((row) => row.receipt === "signed").length,
    readHunks: sum((row) => row.readHunks),
    totalHunks: sum((row) => row.totalHunks),
    readMinutes: sum((row) => row.readMinutes),
    fullMinutes: sum((row) => row.fullMinutes),
  };
}

const STATUS_LABEL: Record<ReceiptStatusValue, string> = {
  "needs-review": "needs review",
  signed: "signed",
  stale: "stale",
  unverified: "signature failed verification",
};

/** The rows as the shell wants them (nav badge, command menu), in inbox order. */
export function toShellChanges(rows: InboxRow[]): ShellChange[] {
  return rows.map((row) =>
    isReviewed(row)
      ? {
          id: row.id,
          title: row.title,
          requirementId: row.requirementId,
          tierLabel: tierLabel[row.tier],
          statusLabel: STATUS_LABEL[row.receipt],
          needsReview: row.receipt !== "signed",
        }
      : {
          id: row.id,
          title: row.title,
          requirementId: row.requirementId,
          tierLabel: null,
          statusLabel: row.state === "missing" ? "not reviewed" : "unreadable",
          needsReview: false,
        },
  );
}
