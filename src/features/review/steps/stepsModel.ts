/**
 * The Review steps panel as data: the four tabs (Read, Blind check, Refused,
 * Sign) and what each shows, built from one review, its report card and its
 * receipt. Pure functions, no React, so the order of the story, which
 * refusals the receipt accepted and which Sign state applies are unit-tested
 * and cannot differ from what is on screen. Spec section 3, S2 sidebar.
 */
import type { Citation, Receipt, ReceiptRecord, Review } from "@/contracts";
import type { ReportCardInput } from "@/features/inbox";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";
import { refusalPolicyVersion, refusalRules } from "@/policy/refusals";
import { fileName, hunkRange, splitCitations } from "../reviewModel";
import type { CheckedCitation } from "../reviewModel";

type Claim = Review["claims"][number];
type Finding = Review["findings"][number];
type Retraction = Review["retractions"][number];

/** The four steps, in the order the person works through them. */
export type StepId = "read" | "blind" | "refused" | "sign";

/** What the Sign step shows: the receipt's status, or "unreadable" when the receipt file exists but fails validation. */
export type SignState = ReceiptStatusValue | "unreadable";

/** One tab of the panel: "1 Read" with a short count under it. */
export interface StepTab {
  id: StepId;
  number: 1 | 2 | 3 | 4;
  label: string;
  /** What is waiting in this step, e.g. "2 contradictions" or "Draft ready". */
  count: string;
  /** Counts that ask for attention (a contradiction, a stale receipt) read in colour as well as words. */
  tone: "neutral" | "amber" | "rose";
}

const STEP_LABELS: Record<StepId, string> = { read: "Read", blind: "Blind check", refused: "Refused", sign: "Sign" };

/** The step ids in tab order; the `1` to `4` keys index into it. */
export const STEP_IDS: readonly StepId[] = ["read", "blind", "refused", "sign"];

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** The tabs with their counts, so a person sees which steps have something for them before opening one. */
export function buildStepTabs(review: Review, record: ReceiptRecord | null, signState: SignState): StepTab[] {
  const openRefusals = openRefusalCount(buildRefusals(review, record, signState));
  const contradictionCount = review.findings.filter((finding) => finding.kind === "contradiction").length;
  const signCount: Record<SignState, Pick<StepTab, "count" | "tone">> = {
    "needs-review": { count: "Draft ready", tone: "neutral" },
    signed: { count: "Signed", tone: "neutral" },
    stale: { count: "Stale", tone: "amber" },
    unverified: { count: "Failed", tone: "rose" },
    unreadable: { count: "Unreadable", tone: "rose" },
  };
  const counts: Record<StepId, Pick<StepTab, "count" | "tone">> = {
    read: { count: plural(review.claims.length, "claim"), tone: "neutral" },
    blind: {
      count: contradictionCount === 0 ? "None found" : plural(contradictionCount, "contradiction"),
      tone: contradictionCount === 0 ? "neutral" : "rose",
    },
    refused: {
      count: review.refusals.length === 0 ? "None" : openRefusals === 0 ? "All accepted" : `${openRefusals} open`,
      tone: openRefusals === 0 ? "neutral" : "amber",
    },
    sign: signCount[signState],
  };
  return STEP_IDS.map((id, index) => ({ id, number: (index + 1) as StepTab["number"], label: STEP_LABELS[id], ...counts[id] }));
}

/** A claim as the story shows it: with the retraction that withdrew it, if any. */
export interface StoryClaim {
  claim: Claim;
  retraction: Retraction | null;
  /** Each citation with the quote check's verdict; a quote not found in the code is never shown. */
  citations: CheckedCitation[];
}

/** A finding with its citations checked the same way. */
export interface FindingView {
  finding: Finding;
  citations: CheckedCitation[];
}

/** The claims that trace to one requirement item, or to none. */
export interface ClaimGroup {
  /** "F1 · The source generator does not throw ...", or "Not traced to a requirement item". */
  heading: string;
  claims: StoryClaim[];
}

/** Everything the Read step shows. */
export interface Story {
  what: string;
  why: string;
  touches: Review["story"]["touches"];
  groups: ClaimGroup[];
  /** "Quote check: 9 of 10 quotes found in the code, 1 claim downgraded, 1 finding dropped.", or null when no quote was checked. */
  quoteCheckLine: string | null;
  defects: FindingView[];
}

const UNTRACED_HEADING = "Not traced to a requirement item";

/**
 * The requirement-traced story: what the change does and why, then its claims
 * grouped by the requirement item they serve, in the requirement's own order
 * (functional items, then non-functional) with the untraced claims last.
 */
export function buildStory(review: Review): Story {
  return {
    what: review.story.what,
    why: review.story.why,
    touches: review.story.touches,
    groups: groupClaims(review),
    quoteCheckLine: quoteCheckLine(review.quoteCheck),
    defects: findingViews(review, "defect"),
  };
}

function groupClaims(review: Review): ClaimGroup[] {
  const storyClaims: StoryClaim[] = review.claims.map((claim) => ({
    claim,
    retraction: review.retractions.find((retraction) => retraction.claimId === claim.id) ?? null,
    citations: splitCitations(review, claim.id, claim.citations),
  }));
  const items = [...review.requirement.functional, ...review.requirement.nonFunctional];
  const groups: ClaimGroup[] = items.map((item) => ({
    heading: `${item.id} · ${item.text}`,
    claims: storyClaims.filter(({ claim }) => claim.requirementItemId === item.id),
  }));
  // A claim naming an item the requirement doesn't have is as untraced as one naming none.
  const knownIds = new Set(items.map((item) => item.id));
  const untraced = storyClaims.filter(({ claim }) => claim.requirementItemId === null || !knownIds.has(claim.requirementItemId));
  return [...groups, { heading: UNTRACED_HEADING, claims: untraced }].filter((group) => group.claims.length > 0);
}

/** The findings of one kind, each with its citations checked. */
function findingViews(review: Review, kind: Finding["kind"]): FindingView[] {
  return review.findings
    .filter((finding) => finding.kind === kind)
    .map((finding) => ({ finding, citations: splitCitations(review, finding.id, finding.citations) }));
}

/** A failed quote downgrades its claim or drops its finding; the two are counted apart. */
function quoteCheckLine({ checked, passed, downgraded, dropped }: Review["quoteCheck"]): string | null {
  if (checked === 0) return null;
  const base = `Quote check: ${passed} of ${checked} quotes found in the code`;
  const outcomes = [downgraded > 0 && plural(downgraded, "claim") + " downgraded", dropped > 0 && plural(dropped, "finding") + " dropped"].filter(Boolean);
  return outcomes.length === 0 ? `${base}.` : `${base}, ${outcomes.join(", ")}.`;
}

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
    expected: (review.expectation?.items ?? []).map((item) => ({ itemId: item.requirementItemId, behaviours: item.expectedBehaviours })),
    contradictions: findingViews(review, "contradiction"),
    readingOrder: comparison?.perPlant.filter((plant) => plant.changeId === review.changeId) ?? [],
    overallLine:
      comparison === null
        ? null
        : `Across ${plural(comparison.plants, "planted contradiction")} × ${comparison.runsPerMode} runs: given the description first caught ${comparison.anchored.caught} of ${comparison.anchored.total} · blind-first caught ${comparison.blind.caught} of ${comparison.blind.total}`,
    missing: findingViews(review, "missing"),
    scopeCreep: findingViews(review, "scope-creep"),
  };
}

/** A place in the diff a button jumps to: "TypeCollector.cs:737–745". */
export interface HunkLocation {
  hunkId: string;
  label: string;
}

/** One refusal with its policy rule, who decides, and whether the signed receipt accepted it. */
export interface RefusalView {
  id: string;
  ruleId: string;
  title: string;
  decider: string;
  reason: string;
  /** "rule": a fixed policy rule raised it with no model involved; "ai": the reviewer did. */
  source: "ai" | "rule";
  locations: HunkLocation[];
  /** The receipt owner when a valid, current receipt accepted this refusal; otherwise null. */
  acceptedBy: string | null;
}

/** Everything the Refused step shows. */
export interface Refusals {
  policyVersion: string;
  ruleCount: number;
  items: RefusalView[];
}

/** The location button of a hunk, or null when the review has no such hunk. */
function locationOf(review: Review, hunkId: string): HunkLocation | null {
  const hunk = review.hunks.find((candidate) => candidate.id === hunkId);
  return hunk ? { hunkId, label: `${fileName(hunk.file)}:${hunkRange(hunk)}` } : null;
}

/** The hunks a finding or refusal names, as location buttons. */
export function locationsOf(review: Review, hunkIds: string[]): HunkLocation[] {
  return hunkIds.flatMap((hunkId) => locationOf(review, hunkId) ?? []);
}

/**
 * The refusals with their rule text from the policy. A refusal counts as
 * accepted only by a receipt that verifies, matches this diff and was signed
 * against this very run: a stale or failed receipt vouches for nothing, and
 * refusal ids ("r1") are numbered per run, so another run's "r2" may be a
 * different refusal. In those cases the decision stays open.
 */
export function buildRefusals(review: Review, record: ReceiptRecord | null, signState: SignState): Refusals {
  const isAcceptanceCurrent = signState === "signed" && record !== null && record.receipt.reviewRunId === review.run.id;
  const accepted = isAcceptanceCurrent ? record.receipt.residualRisk.acceptedRefusalIds : [];
  return {
    policyVersion: refusalPolicyVersion,
    ruleCount: refusalRules.length,
    items: review.refusals.map((refusal) => {
      const rule = refusalRules.find((candidate) => candidate.id === refusal.ruleId);
      return {
        id: refusal.id,
        ruleId: refusal.ruleId,
        title: rule?.title ?? `Rule not in refusal policy ${refusalPolicyVersion}`,
        decider: rule?.decider ?? "not named in the policy",
        reason: refusal.reason,
        source: refusal.source,
        locations: locationsOf(review, refusal.hunkIds),
        acceptedBy: accepted.includes(refusal.id) && record !== null ? record.receipt.owner : null,
      };
    }),
  };
}

/** The refusals nobody has accepted yet. */
function openRefusalCount(refusals: Refusals): number {
  return refusals.items.filter((item) => item.acceptedBy === null).length;
}

/** The commands the Sign step offers, written out for this change. */
export interface SignCommands {
  draft: string;
  sign: string;
  verify: string;
}

/** What the Sign step shows, by receipt status. The site never signs: it shows the drafted receipt and the command to run. */
export type SignView =
  | { status: "unreadable"; commands: SignCommands }
  | { status: "needs-review"; draft: Review["receiptDraft"]; commands: SignCommands }
  | { status: "signed"; receipt: Receipt; verify: ReceiptRecord["verify"]; commands: SignCommands }
  | { status: "stale"; receipt: Receipt; reviewDiffSha256: string; commands: SignCommands }
  | { status: "unverified"; receipt: Receipt; verify: ReceiptRecord["verify"]; commands: SignCommands };

/** Picks the Sign state from `receiptStatus()` (or "unreadable" for a receipt file that fails validation)'s answer, so the panel and the badges always agree. */
export function buildSignView(review: Review, record: ReceiptRecord | null, signState: SignState): SignView {
  const commands: SignCommands = {
    draft: `pnpm countersign draft ${review.changeId}`,
    sign: `pnpm countersign sign ${review.changeId}`,
    verify: `pnpm countersign verify ${review.changeId}`,
  };
  if (signState === "unreadable") return { status: signState, commands };
  if (record === null || signState === "needs-review") return { status: "needs-review", draft: review.receiptDraft, commands };
  if (signState === "stale") return { status: signState, receipt: record.receipt, reviewDiffSha256: review.diff.diffSha256, commands };
  return { status: signState, receipt: record.receipt, verify: record.verify, commands };
}

const SIGNED_AT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * "13 Nov 2026, 17:22 UTC". UTC is fixed so the server's HTML and the
 * browser's agree; a local zone would flash a different time on hydration.
 */
export function formatSignedAt(isoTimestamp: string): string {
  return `${SIGNED_AT.format(new Date(isoTimestamp))} UTC`;
}

/** The "file:line" text of a citation: "TypeCollector.cs:737–740", or one line when it cites one. */
export function citationLabel(citation: Citation): string {
  const lines = citation.startLine === citation.endLine ? String(citation.startLine) : `${citation.startLine}–${citation.endLine}`;
  return `${fileName(citation.file)}:${lines}`;
}

/** The label of a button that opens the Sign step; there is nothing to sign for a signed change or an unreadable file. */
export function signActionLabel(signState: SignState): string {
  const labels: Record<SignState, string> = {
    "needs-review": "Sign",
    stale: "Re-sign",
    unverified: "Re-sign",
    signed: "View receipt",
    unreadable: "View receipt",
  };
  return labels[signState];
}

/** Whether a person can sign now: only a change with no receipt, or a stale or failed one, can be (re)signed. */
export function isSignable(signState: SignState): boolean {
  return signState === "needs-review" || signState === "stale" || signState === "unverified";
}
