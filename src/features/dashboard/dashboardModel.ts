/**
 * The dashboard as data: what signing covered, what it didn't, and who still
 * has to decide. Everything is counted from the recorded reviews, receipts and
 * report card, and routed with the current simulated escapes, so an escape
 * moves the tier-dependent numbers without a reload. Pure functions, no React.
 * Spec section 3, S5.
 */
import { areaLabel, tierLabel } from "@/contracts";
import type { Area, LadderLevel, Tier } from "@/contracts";
import { buildInboxModel, isReviewed } from "@/features/inbox";
import type { InboxModel, InboxSource } from "@/features/inbox";
import { decideChange, inboxLevels } from "@/lib/decideChange";
import type { ReportCardInput } from "@/lib/decideChange";
import { receiptStatus } from "@/lib/data/receiptStatus";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";
import { refusalRules } from "@/policy/refusals";

/** Tiers in the order the dashboard lists them: the least reading first. */
export const TIERS: readonly Tier[] = ["light", "focused", "full"];

/** Areas in the order of the report card. */
export const AREAS: readonly Area[] = ["generator", "analyzer", "security", "performance"];

/** The counts in the facts strip. "Median time to sign" is not here: it is not measured. */
export interface DashboardFacts {
  /** Receipts whose signature verified and whose diff still matches the review. */
  signed: number;
  changes: number;
  /** Changes with a readable review: the sample behind the hunk and contradiction counts. */
  reviewedChanges: number;
  readHunks: number;
  totalHunks: number;
  contradictions: number;
  /** Simulated escapes recorded in this browser, across all areas. */
  escapes: number;
}

/** What a receipt that carries a residual-risk line can say: it holds, its code changed, or its signature failed verification. */
export type RiskStatus = Exclude<ReceiptStatusValue, "needs-review">;

/** One residual-risk line from a receipt, with whether it still holds. */
export interface AcceptedRisk {
  changeId: string;
  text: string;
  /** GitHub login of the signer. */
  owner: string;
  signedAt: string;
  status: RiskStatus;
}

/** Refusals of one rule across changes, still waiting on their decider. */
export interface OpenDecision {
  ruleId: string;
  title: string;
  count: number;
  changeIds: string[];
}

/** Everything one decider has to decide. */
export interface DeciderQueue {
  decider: string;
  decisions: OpenDecision[];
  count: number;
}

/** Hunks of the changes in one tier: how many a person reads and how many evidence covers. */
export interface TierAttention {
  tier: Tier;
  changes: number;
  readHunks: number;
  totalHunks: number;
  readMinutes: number;
}

/** One reason for escalating above Light and how many changes it fired in. */
export interface EscalationReason {
  ruleId: string;
  label: string;
  changes: number;
}

/** The reviewer's level in one area, after simulated escapes. */
export interface AreaTrust {
  area: Area;
  label: string;
  level: LadderLevel;
}

/** Everything the dashboard draws. */
export interface DashboardModel {
  /** The inbox model: the shell's change list and the "Review next" pick come from it. */
  inbox: InboxModel;
  facts: DashboardFacts;
  /** False until any readable receipt exists, stale or unverified included; the signing sections then show an empty state. */
  hasReceipts: boolean;
  acceptedRisks: AcceptedRisk[];
  deciderQueues: DeciderQueue[];
  attention: TierAttention[];
  escalationReasons: EscalationReason[];
  trust: AreaTrust[];
}

// route() reasons carry sentences with the numbers in them ("3 items refused");
// counting by rule id needs one stable name per rule. A rule added to route()
// without a label here shows the sentence route() gave, so it is never unnamed.
const REASON_LABEL: Record<string, string> = {
  "R-size": "Large change outside generated files",
  "R-read-share": "Most hunks need a human",
  "R-escape": "A bug escaped in this area",
  "R-refusal": "Refused item: a human decides",
  "R-contradiction": "Description contradicts the code",
  "R-defect": "Defect found",
  "R-sensitive-path": "Touches a sensitive path",
  "R-area-level": "Area not yet Trusted",
  "R-unread": "Hunks without checked evidence",
  "R-no-track-record": "No readable report card",
};

const RISK_ORDER: Record<RiskStatus, number> = { unverified: 0, stale: 1, signed: 2 };

const UNLISTED_DECIDER = "No decider in the refusal policy";

/**
 * Builds the dashboard from the recorded sources.
 *
 * @param escapes simulated escapes per area; they lower the trust levels and so re-route every change
 */
export function buildDashboardModel(
  sources: InboxSource[],
  reportCard: ReportCardInput,
  escapes: Partial<Record<Area, number>>,
): DashboardModel {
  const levels = inboxLevels(reportCard, escapes);
  const inbox = buildInboxModel(sources, reportCard, escapes);
  const acceptedRisks = collectAcceptedRisks(sources);
  return {
    inbox,
    facts: collectFacts(inbox, escapes),
    hasReceipts: acceptedRisks.length > 0,
    acceptedRisks,
    deciderQueues: collectDeciderQueues(sources),
    attention: collectAttention(inbox),
    escalationReasons: collectEscalationReasons(sources, reportCard, escapes),
    trust: AREAS.map((area) => ({ area, label: areaLabel[area], level: levels[area] })),
  };
}

function collectFacts(inbox: InboxModel, escapes: Partial<Record<Area, number>>): DashboardFacts {
  const { summary, rows } = inbox;
  return {
    signed: summary.signed,
    changes: summary.changes,
    reviewedChanges: rows.filter(isReviewed).length,
    readHunks: summary.readHunks,
    totalHunks: summary.totalHunks,
    contradictions: rows.filter(isReviewed).reduce((total, row) => total + row.contradictions, 0),
    escapes: Object.values(escapes).reduce((total, count) => total + count, 0),
  };
}

/** Lines that no longer hold (failed verification, then stale) first: they ask for action; then by change id. */
function collectAcceptedRisks(sources: InboxSource[]): AcceptedRisk[] {
  const risks: AcceptedRisk[] = [];
  for (const { change, review, receipt } of sources) {
    if (review.state !== "ok" || receipt === null || receipt === "unreadable") continue;
    risks.push({
      changeId: change.id,
      text: receipt.receipt.residualRisk.text,
      owner: receipt.receipt.owner,
      signedAt: receipt.receipt.signedAt,
      status: receiptStatus(review.data, receipt) as RiskStatus,
    });
  }
  return risks.sort((a, b) => RISK_ORDER[a.status] - RISK_ORDER[b.status] || a.changeId.localeCompare(b.changeId));
}

/**
 * Refusals no signed receipt has accepted, grouped by the decider the refusal
 * policy names. A stale receipt accepts nothing: it vouches for older code.
 */
function collectDeciderQueues(sources: InboxSource[]): DeciderQueue[] {
  const decisionsByRule = new Map<string, OpenDecision>();
  for (const { change, review, receipt } of sources) {
    if (review.state !== "ok") continue;
    const record = receipt === "unreadable" ? null : receipt;
    const isSigned = receiptStatus(review.data, record) === "signed";
    const acceptedIds = isSigned ? (record?.receipt.residualRisk.acceptedRefusalIds ?? []) : [];
    for (const refusal of review.data.refusals) {
      if (acceptedIds.includes(refusal.id)) continue;
      const decision = decisionsByRule.get(refusal.ruleId) ?? {
        ruleId: refusal.ruleId,
        title: refusalRules.find((rule) => rule.id === refusal.ruleId)?.title ?? refusal.ruleId,
        count: 0,
        changeIds: [],
      };
      decision.count += 1;
      if (!decision.changeIds.includes(change.id)) decision.changeIds.push(change.id);
      decisionsByRule.set(refusal.ruleId, decision);
    }
  }
  return groupByDecider([...decisionsByRule.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId)));
}

function groupByDecider(decisions: OpenDecision[]): DeciderQueue[] {
  const queues = new Map<string, DeciderQueue>();
  for (const decision of decisions) {
    const decider = refusalRules.find((rule) => rule.id === decision.ruleId)?.decider ?? UNLISTED_DECIDER;
    const queue = queues.get(decider) ?? { decider, decisions: [], count: 0 };
    queue.decisions.push(decision);
    queue.count += decision.count;
    queues.set(decider, queue);
  }
  return [...queues.values()];
}

function collectAttention(inbox: InboxModel): TierAttention[] {
  const reviewed = inbox.rows.filter(isReviewed);
  return TIERS.map((tier) => {
    const inTier = reviewed.filter((row) => row.tier === tier);
    return {
      tier,
      changes: inTier.length,
      readHunks: inTier.reduce((total, row) => total + row.readHunks, 0),
      totalHunks: inTier.reduce((total, row) => total + row.totalHunks, 0),
      readMinutes: inTier.reduce((total, row) => total + row.readMinutes, 0),
    };
  });
}

/** Rules that asked for more than Light, by the number of changes each fired in, most frequent first. */
function collectEscalationReasons(sources: InboxSource[], reportCard: ReportCardInput, escapes: Partial<Record<Area, number>>): EscalationReason[] {
  const byRule = new Map<string, { changes: number; text: string; lastChange: string }>();
  for (const { change, review } of sources) {
    if (review.state !== "ok") continue;
    const escalating = decideChange(review.data, reportCard, escapes).decision.reasons.filter((reason) => reason.tier !== "light");
    for (const reason of escalating) {
      const seen = byRule.get(reason.ruleId);
      // R-area-level can fire once per area in one change; count the change once.
      if (seen && seen.lastChange === change.id) continue;
      byRule.set(reason.ruleId, { changes: (seen?.changes ?? 0) + 1, text: seen?.text ?? reason.text, lastChange: change.id });
    }
  }
  return [...byRule]
    .map(([ruleId, { changes, text }]) => ({ ruleId, label: reasonLabel(ruleId, text), changes }))
    .sort((a, b) => b.changes - a.changes || a.ruleId.localeCompare(b.ruleId));
}

/** The stable name for a rule id, or the sentence `route()` gave when the id has no label here. */
export function reasonLabel(ruleId: string, routedText: string): string {
  return REASON_LABEL[ruleId] ?? routedText;
}

/** Text for a tier's bar, e.g. "Focused: a person read 2 of 8 hunks, about 3 min". */
export function attentionSummary(row: TierAttention): string {
  if (row.changes === 0) return `${tierLabel[row.tier]}: no changes`;
  return `${tierLabel[row.tier]}: a person read ${row.readHunks} of ${row.totalHunks} hunks, about ${row.readMinutes} min`;
}
