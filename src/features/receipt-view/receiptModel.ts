/**
 * Signed receipt in git (idea 7), as the data the receipt page draws. A
 * receipt is bound to one diff by `diffSha256`; this turns the exported
 * record, the review it should cover and the refusal policy into plain values:
 * which state the page is in, the identity rows, the signer's three sections
 * with refusal ids resolved to rule titles, and the hunk ledger.
 * Pure functions, no React. Spec section 3, S4.
 */
import type { Coverage, ReceiptRecord, Review } from "@/contracts";
import { tierLabel } from "@/contracts";
import type { InboxSource } from "@/features/inbox";
import { receiptStatus } from "@/lib/data/receiptStatus";
import { refusalRules } from "@/policy/refusals";

/** Whether the receipt vouches for this diff: signed does, stale and unverified do not. */
export type SignedStatus = "signed" | "stale" | "unverified";

/** One label and value of the identity block; values are ids and hashes, shown in mono. */
export interface IdentityRow {
  label: string;
  value: string;
}

/** An item the signer lists as checked, with who or what checked it. */
export interface CheckedItem {
  item: string;
  by: string;
}

/** An item the signer lists as not checked, with the reason. */
export interface NotCheckedItem {
  item: string;
  reason: string;
}

/** A refusal the signer accepted; `rule` is null when the review that holds the refusal is unavailable. */
export interface AcceptedRefusal {
  refusalId: string;
  rule: { id: string; title: string } | null;
}

/** One hunk of the signed diff and what covered it. */
export interface LedgerRow {
  hunkId: string;
  location: string;
  coverage: Coverage;
  /** The signer's login when a person had to read this hunk, else null. */
  readBy: string | null;
}

/** The receipt page in one of its states. */
export type ReceiptView =
  | { kind: "none"; changeId: string; signCommand: string }
  | { kind: "invalid"; changeId: string; error: string }
  | ReceiptDocumentView;

/** A readable receipt, signed, stale or unverified. */
export interface ReceiptDocumentView {
  kind: "document";
  status: SignedStatus;
  changeId: string;
  title: string;
  requirementId: string;
  /** "Focused review. A person read 2 of 8 hunks; ..."; null unless signed, because only then the review describes the signed diff. */
  summary: string | null;
  identity: IdentityRow[];
  checked: CheckedItem[];
  notChecked: NotCheckedItem[];
  residualRisk: { text: string; accepted: AcceptedRefusal[] };
  /** Only for a signed receipt: for a stale one the review describes a different diff. */
  ledger: LedgerRow[] | null;
  owner: string;
  signedAt: string;
  verifyCommand: string;
  /** The verify command and its recorded output, as one console text. */
  verifyText: string;
  verifyLine: string;
  /** The hash of the diff that was signed and of the diff now under review; set only when stale. */
  staleHashes: { signed: string; current: string } | null;
  signCommand: string;
  recordJson: string;
}

const BY_LABEL = { tool: "Tool", "ai-supported": "AI, supported", human: "Human" } as const;

/** Verify line copy from spec section 3 (S2, Receipt tab). */
const VERIFY_LINE_OK = "Signature valid · diff unchanged";
const VERIFY_LINE_OK_WITHOUT_REVIEW = "Signature valid";
const VERIFY_LINE_STALE = "The signature is valid, but it covers an older diff.";
const VERIFY_LINE_FAILED = "The signature check failed when this receipt was exported.";

/** The command that signs a fresh receipt for a change. */
export function signCommand(changeId: string): string {
  return `pnpm countersign sign ${changeId}`;
}

/**
 * Decides which state the receipt page is in and gathers what each state shows.
 *
 * Without a readable review the diff cannot be compared, so a receipt whose
 * recorded check passed counts as signed, and the page does not claim the diff is unchanged.
 *
 * @param source The change with its review and receipt, as the inbox reads them.
 * @param receiptError The validation error of the receipt file, when it exists but fails its schema.
 */
export function buildReceiptView({ change, review: reviewState, receipt: receiptFile }: InboxSource, receiptError: string | null): ReceiptView {
  if (receiptFile === null) return { kind: "none", changeId: change.id, signCommand: signCommand(change.id) };
  if (receiptFile === "unreadable") {
    return { kind: "invalid", changeId: change.id, error: receiptError ?? `data/receipts/${change.id}.json failed validation.` };
  }

  const record = receiptFile;
  const review = reviewState.state === "ok" ? reviewState.data : null;
  const status = statusOf(review, record);
  const { receipt, verify } = record;
  return {
    kind: "document",
    status,
    changeId: change.id,
    title: change.title,
    requirementId: receipt.requirementId,
    summary: status === "signed" && review !== null ? readingSummary(review) : null,
    identity: identityRows(record, review),
    checked: receipt.checked.map(({ item, by }) => ({ item, by: BY_LABEL[by] })),
    notChecked: receipt.notChecked,
    residualRisk: { text: receipt.residualRisk.text, accepted: acceptedRefusals(receipt.residualRisk.acceptedRefusalIds, review) },
    ledger: status === "signed" && review !== null ? hunkLedger(review, receipt.owner) : null,
    owner: receipt.owner,
    signedAt: formatUtc(receipt.signedAt),
    verifyCommand: verify.command,
    verifyText: `$ ${verify.command}\n${verify.output}`,
    verifyLine: verifyLine(status, review),
    staleHashes: status === "stale" && review !== null ? { signed: receipt.diffSha256, current: review.diff.diffSha256 } : null,
    signCommand: signCommand(change.id),
    recordJson: JSON.stringify(record, null, 2),
  };
}

function statusOf(review: Review | null, record: ReceiptRecord): SignedStatus {
  if (review === null) return record.verify.ok ? "signed" : "unverified";
  const status = receiptStatus(review, record);
  // "needs-review" means no record, which cannot happen here; unverified is the safe reading.
  return status === "needs-review" ? "unverified" : status;
}

function verifyLine(status: SignedStatus, review: Review | null): string {
  if (status === "unverified") return VERIFY_LINE_FAILED;
  if (status === "stale") return VERIFY_LINE_STALE;
  return review === null ? VERIFY_LINE_OK_WITHOUT_REVIEW : VERIFY_LINE_OK;
}

/** "Focused review. A person read 2 of 8 hunks; tests or checked quotes covered the other 6." */
function readingSummary({ routing }: Review): string {
  const covered = routing.totalHunks - routing.readHunks;
  return `${tierLabel[routing.tier]} review. A person read ${routing.readHunks} of ${routing.totalHunks} hunks; tests or checked quotes covered the other ${covered}.`;
}

function identityRows({ receipt }: ReceiptRecord, review: Review | null): IdentityRow[] {
  const rows: IdentityRow[] = [
    { label: "commit", value: receipt.commit },
    { label: "base", value: receipt.baseCommit },
    { label: "diffSha256", value: receipt.diffSha256 },
    { label: "repo", value: receipt.repo },
    { label: "reviewer", value: `${receipt.reviewerVersion} · ${receipt.reviewRunId}` },
  ];
  if (review !== null) rows.push({ label: "author", value: `${review.authorAgent} (agent)` });
  rows.push({ label: "signer key", value: receipt.owner });
  return rows;
}

/**
 * Looks each accepted refusal id ("r2", the id inside the review) up in the
 * review to find its rule ("R5"), then in the refusal policy for the rule's title.
 */
function acceptedRefusals(refusalIds: string[], review: Review | null): AcceptedRefusal[] {
  return refusalIds.map((refusalId) => {
    const ruleId = review?.refusals.find((refusal) => refusal.id === refusalId)?.ruleId;
    const rule = refusalRules.find((candidate) => candidate.id === ruleId);
    return { refusalId, rule: rule ? { id: rule.id, title: rule.title } : null };
  });
}

const COVERAGE_ORDER: Coverage[] = ["read", "supported", "verified"];

/** One row per hunk, the ones a person read first, in diff order within each group. */
function hunkLedger(review: Review, owner: string): LedgerRow[] {
  const rows = review.hunks.map((hunk) => {
    // A hunk the routing did not classify has no evidence behind it, so a person has to read it.
    const coverage = review.routing.coverage[hunk.id] ?? "read";
    const lastLine = Math.max(hunk.newStart, hunk.newStart + hunk.newLines - 1);
    return {
      hunkId: hunk.id,
      location: `${hunk.file}:${hunk.newStart}–${lastLine}`,
      coverage,
      readBy: coverage === "read" ? owner : null,
    };
  });
  return COVERAGE_ORDER.flatMap((coverage) => rows.filter((row) => row.coverage === coverage));
}

/** "2026-11-14 09:40 UTC", formatted without locale so the server and the browser agree. */
export function formatUtc(timestamp: string): string {
  return `${new Date(timestamp).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
