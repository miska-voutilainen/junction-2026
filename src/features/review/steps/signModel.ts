/**
 * The Sign step as data: which state the receipt is in, what the panel shows
 * for it and the commands to run. The site never signs; a person does, on
 * their own machine. Idea 7, signed receipt. Spec section 3, S2 sidebar.
 */
import type { Receipt, ReceiptRecord, Review } from "@/contracts";
import { countersignCommand } from "@/lib/countersignCommand";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";

/** What the Sign step shows: the receipt's status, or "unreadable" when the receipt file exists but fails validation. */
export type SignState = ReceiptStatusValue | "unreadable";

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
  | {
      status: "unverified";
      receipt: Receipt;
      verify: ReceiptRecord["verify"];
      commands: SignCommands;
    };

/**
 * What the Sign step shows for `signState`. The caller passes the same state the badges use (from `receiptStatus()`, or "unreadable"), so the panel and the badges agree.
 */
export function buildSignView(
  review: Review,
  record: ReceiptRecord | null,
  signState: SignState,
): SignView {
  const commands: SignCommands = {
    draft: countersignCommand("draft", review.changeId),
    sign: countersignCommand("sign", review.changeId),
    verify: countersignCommand("verify", review.changeId),
  };
  if (signState === "unreadable") return { status: signState, commands };
  if (record === null || signState === "needs-review")
    return { status: "needs-review", draft: review.receiptDraft, commands };
  if (signState === "stale")
    return {
      status: signState,
      receipt: record.receipt,
      reviewDiffSha256: review.diff.diffSha256,
      commands,
    };
  return { status: signState, receipt: record.receipt, verify: record.verify, commands };
}

/** The states a person can act on by signing. */
export type SignableState = Extract<SignState, "needs-review" | "stale" | "unverified">;

/** Whether a person can sign now: only a change with no receipt, or a stale or failed one, can be (re)signed. */
export function isSignable(signState: SignState): signState is SignableState {
  return signState === "needs-review" || signState === "stale" || signState === "unverified";
}

/**
 * The label of a button that opens the Sign step. A signed change or an
 * unreadable file has no such button: the header's "View full receipt" link is
 * the one way to the receipt, so the page never offers two for one place.
 */
export function signActionLabel(signState: SignableState): string {
  return signState === "needs-review" ? "Sign" : "Re-sign";
}
