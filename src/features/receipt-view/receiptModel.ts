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
import { receiptStatus, signerOf } from "@/lib/data/receiptStatus";
import type { SignerState } from "@/lib/data/receiptStatus";
import { refusalRules } from "@/policy/refusals";
import { verifyLine } from "@/lib/receiptCopy";

/**
 * Whether the receipt vouches for this diff. Only "signed" does. "unchecked":
 * the signature verified but no readable review exists to compare the diff with.
 */
export type ReceiptDocumentStatus = "signed" | "stale" | "unverified" | "unchecked";

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

/**
 * A refusal the signer accepted. `rule` is null unless the review on hand is the
 * run the receipt was signed against: a re-run can number its refusals differently,
 * so the same id could name another rule.
 */
export interface AcceptedRefusal {
  refusalId: string;
  rule: { id: string; title: string } | null;
  /** The run the refusal id was recorded in, from the receipt. */
  runId: string;
}

/** One hunk of the signed diff and what covered it, as the receipt's signed `hunks` list records it. */
export interface LedgerRow {
  hunkId: string;
  file: string;
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
  status: ReceiptDocumentStatus;
  changeId: string;
  title: string;
  requirementId: string;
  /** "Focused review. A person read 2 of 8 hunks. ..."; null unless signed, because only then the review describes the signed diff. */
  summary: string | null;
  identity: IdentityRow[];
  checked: CheckedItem[];
  notChecked: NotCheckedItem[];
  residualRisk: { text: string; accepted: AcceptedRefusal[] };
  /**
   * Read from the receipt's signed payload, not the review, so it is what was
   * signed even when the receipt is stale. Empty when the receipt lists no hunks.
   */
  ledger: LedgerRow[];
  /** The roles line's three parties; `reviewerVersion` is the one the receipt names. */
  roles: { authorAgent: string; reviewerVersion: string; signer: SignerState };
  owner: string;
  signedAt: string;
  verifyCommand: string;
  /** The verify command and its recorded output, as one console text. */
  verifyText: string;
  verifyLine: string;
  /** The signed and the reviewed diff hash, each cut to 12 characters; set only when stale. The full hashes are in `identity`. */
  staleHashes: { signedDiff: string; reviewedDiff: string } | null;
  signCommand: string;
  recordJson: string;
}

const BY_LABEL = { tool: "Tool", "ai-supported": "AI, supported", human: "Human" } as const;

/** The command that signs a fresh receipt for a change. */
function signCommand(changeId: string): string {
  return `pnpm countersign sign ${changeId}`;
}

/**
 * Decides which state the receipt page is in and gathers what each state shows.
 *
 * Without a readable review the diff cannot be compared, so a receipt whose
 * recorded check passed is "unchecked": no seal, no claim that the diff is unchanged.
 *
 * @param source The change with its review and receipt, as the inbox reads them.
 * @param receiptError The validation error of the receipt file, when it exists but fails its schema.
 * @param receiptText The receipt file's exact text for Copy JSON; the parsed record re-serialised when absent.
 */
export function buildReceiptView(
  { change, review: reviewState, receipt: receiptFile }: InboxSource,
  receiptError: string | null,
  receiptText: string | null,
): ReceiptView {
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
    identity: identityRows(record),
    checked: receipt.checked.map(({ item, by }) => ({ item, by: BY_LABEL[by] })),
    notChecked: receipt.notChecked,
    residualRisk: { text: receipt.residualRisk.text, accepted: acceptedRefusals(record, review) },
    ledger: hunkLedger(receipt.hunks),
    roles: { authorAgent: change.authorAgent, reviewerVersion: receipt.reviewerVersion, signer: signerOf(record) },
    owner: receipt.owner,
    signedAt: formatUtc(receipt.signedAt),
    verifyCommand: verify.command,
    verifyText: `$ ${verify.command}\n${verify.output}`,
    verifyLine: verifyLine(status),
    staleHashes: status === "stale" && review !== null ? { signedDiff: shortHash(receipt.diffSha256), reviewedDiff: shortHash(review.diff.diffSha256) } : null,
    signCommand: signCommand(change.id),
    recordJson: receiptText ?? JSON.stringify(record, null, 2),
  };
}

function statusOf(review: Review | null, record: ReceiptRecord): ReceiptDocumentStatus {
  if (review === null) return record.verify.ok ? "unchecked" : "unverified";
  const status = receiptStatus(review, record);
  // "needs-review" means no record, which cannot happen here; unverified is the safe reading.
  return status === "needs-review" ? "unverified" : status;
}

/** "Focused review. A person read 2 of 8 hunks. Tests or checked quotes covered the other 6." */
function readingSummary({ routing }: Review): string {
  const covered = routing.totalHunks - routing.readHunks;
  return `${tierLabel[routing.tier]} review. A person read ${routing.readHunks} of ${routing.totalHunks} hunks. Tests or checked quotes covered the other ${covered}.`;
}

function identityRows({ receipt }: ReceiptRecord): IdentityRow[] {
  return [
    { label: "commit", value: receipt.commit },
    { label: "base", value: receipt.baseCommit },
    { label: "diffSha256", value: receipt.diffSha256 },
    { label: "repo", value: receipt.repo },
    { label: "reviewer", value: `${receipt.reviewerVersion} · ${receipt.reviewRunId}` },
  ];
}

/**
 * Looks each accepted refusal id ("r2", the id inside the review) up in the
 * review to find its rule ("R5"), then in the refusal policy for the rule's
 * title, but only when the review is the run the receipt names.
 */
function acceptedRefusals({ receipt }: ReceiptRecord, review: Review | null): AcceptedRefusal[] {
  const isSameRun = review !== null && review.run.id === receipt.reviewRunId;
  return receipt.residualRisk.acceptedRefusalIds.map((refusalId) => {
    const ruleId = isSameRun ? review.refusals.find((refusal) => refusal.id === refusalId)?.ruleId : undefined;
    const rule = refusalRules.find((candidate) => candidate.id === ruleId);
    return { refusalId, rule: rule ? { id: rule.id, title: rule.title } : null, runId: receipt.reviewRunId };
  });
}

const SHORT_HASH_LENGTH = 12;

function shortHash(hash: string): string {
  return hash.slice(0, SHORT_HASH_LENGTH);
}

const COVERAGE_ORDER: Coverage[] = ["read", "supported", "verified"];

/** One row per signed hunk, the ones a person read first, in the signed order within each group. */
function hunkLedger(signedHunks: ReceiptRecord["receipt"]["hunks"]): LedgerRow[] {
  return COVERAGE_ORDER.flatMap((coverage) => signedHunks.filter((hunk) => hunk.coverage === coverage));
}

/** "2026-11-14 09:40 UTC", formatted without locale so the server and the browser agree. */
export function formatUtc(timestamp: string): string {
  return `${new Date(timestamp).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
